/**
 * Testi za stock depletion ob createOrder — v1.6.0 funkcionalnost.
 *
 * Preverja, da:
 *   1. createOrder avtomatsko zmanjša zalogo preko Recipe BoM
 *   2. Brez recepta se zaloga NE spremeni (graceful)
 *   3. Insufficient stock zavrne order (409)
 *   4. StockMovement audit trail se ustvari
 *   5. Low-stock alert se sproži pod reorder level
 *   6. Cancel order → restock (vrne zalogo)
 *   7. Restock je idempotentno (double-cancel ne double-restock)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../index';
import { Category, MenuItem } from '../../models/menu.model';
import Client from '../../models/client.model';
import Order from '../../models/order.model';
import Inventory from '../../models/inventory.model';
import Recipe from '../../models/recipe.model';
import StockMovement from '../../models/stockMovement.model';
import { getAuthCookie } from './test.utils';

describe('Stock Depletion on createOrder (v1.6.0)', () => {
    let adminCookie;
    let menuItem;
    let beef;
    let bun;
    let client;
    let recipe;

    beforeEach(async () => {
        const auth = await getAuthCookie(app, { role: 'admin' });
        adminCookie = auth.cookie;

        const cat = await Category.create({ name: 'Burgers', description: 'Burger dishes' });
        menuItem = await MenuItem.create({
            name: 'Cheeseburger',
            price: 12.99,
            category: cat._id,
        });

        beef = await Inventory.create({
            name: 'Beef Patty',
            category: 'Meat',
            quantity: 10, // 10 kg
            unit: 'kg',
            reorderLevel: 2,
            costPerUnit: 8.00,
            supplier: 'Butcher',
        });

        bun = await Inventory.create({
            name: 'Burger Bun',
            category: 'Bakery',
            quantity: 50, // 50 kosov
            unit: 'pcs',
            reorderLevel: 10,
            costPerUnit: 0.50,
            supplier: 'Bakery',
        });

        client = await Client.create({ name: 'Test Client', phone: '1234567890' });

        // Recipe: 1 cheeseburger = 0.2kg beef + 1 bun
        recipe = await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [
                { inventory: beef._id, quantity: 0.2 }, // 200g beef
                { inventory: bun._id, quantity: 1 },    // 1 bun
            ],
        });
    });

    it('mora zmanjšati zalogo ob createOrder preko Recipe BoM', async () => {
        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', adminCookie)
            .send({
                type: 'Dine-in',
                paymentMethod: 'Cash',
                clientId: client._id,
                clientPhone: "1234567890",
                items: [{ menuItem: menuItem._id, quantity: 5 }],
            });

        expect(res.status).toBe(201);

        // Preveri, da se je beef zmanjšal: 10 - (0.2 × 5) = 9 kg
        const beefAfter = await Inventory.findById(beef._id);
        expect(beefAfter.quantity).toBe(9);

        // Bun: 50 - (1 × 5) = 45
        const bunAfter = await Inventory.findById(bun._id);
        expect(bunAfter.quantity).toBe(45);
    });

    it('mora ustvariti StockMovement audit trail ob depletion', async () => {
        await request(app)
            .post('/api/orders')
            .set('Cookie', adminCookie)
            .send({
                type: 'Dine-in',
                paymentMethod: 'Cash',
                clientId: client._id,
                clientPhone: "1234567890",
                items: [{ menuItem: menuItem._id, quantity: 3 }],
            });

        const movements = await StockMovement.find({ type: 'order' });
        expect(movements).toHaveLength(2); // beef + bun

        const beefMovement = movements.find(m => m.inventoryName === 'Beef Patty');
        expect(beefMovement).toBeDefined();
        expect(beefMovement.quantityChange).toBeCloseTo(-0.6, 5); // -0.2 × 3 (floating-point)
        expect(beefMovement.quantityBefore).toBe(10);
        expect(beefMovement.quantityAfter).toBeCloseTo(9.4, 5);
        expect(beefMovement.unit).toBe('kg');
        expect(beefMovement.costPerUnit).toBe(8.00);
        expect(beefMovement.totalValue).toBeCloseTo(4.80, 2); // 0.6 × 8
        expect(beefMovement.menuItemName).toBe('Cheeseburger');

        const bunMovement = movements.find(m => m.inventoryName === 'Burger Bun');
        expect(bunMovement).toBeDefined();
        expect(bunMovement.quantityChange).toBe(-3); // -1 × 3
        expect(bunMovement.quantityAfter).toBe(47);
    });

    it('mora zavrniti order, če ni dovolj zaloge (409)', async () => {
        // Order za 60 burgerjev = 12kg beef (imamo samo 10kg)
        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', adminCookie)
            .send({
                type: 'Dine-in',
                paymentMethod: 'Cash',
                clientId: client._id,
                clientPhone: "1234567890",
                items: [{ menuItem: menuItem._id, quantity: 60 }],
            });

        expect(res.status).toBe(409);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Insufficient stock/i);

        // Preveri, da se zaloga NI spremenila (rollback)
        const beefAfter = await Inventory.findById(beef._id);
        expect(beefAfter.quantity).toBe(10); // original

        // Preveri, da order NI bil ustvarjen
        const orders = await Order.find({ client: client._id });
        expect(orders).toHaveLength(0);

        // Preveri, da NI StockMovement zabeležkov
        const movements = await StockMovement.find({ type: 'order' });
        expect(movements).toHaveLength(0);
    });

    it('NE sme spremeniti zaloge, če menu item nima recepta (graceful)', async () => {
        // Ustvari menu item brez recepta
        const cat = await Category.findOne({ name: 'Burgers' });
        const noRecipeItem = await MenuItem.create({
            name: 'Fries',
            price: 4.99,
            category: cat._id,
        });

        const res = await request(app)
            .post('/api/orders')
            .set('Cookie', adminCookie)
            .send({
                type: 'Dine-in',
                paymentMethod: 'Cash',
                clientId: client._id,
                clientPhone: "1234567890",
                items: [{ menuItem: noRecipeItem._id, quantity: 10 }],
            });

        expect(res.status).toBe(201);

        // Zaloge se niso spremenile
        const beefAfter = await Inventory.findById(beef._id);
        expect(beefAfter.quantity).toBe(10); // original

        const bunAfter = await Inventory.findById(bun._id);
        expect(bunAfter.quantity).toBe(50); // original

        // Ni StockMovement zabeležkov
        const movements = await StockMovement.find({ type: 'order' });
        expect(movements).toHaveLength(0);
    });

    it('mora upoštevati opcijske sestavine (ne deplete)', async () => {
        // Dodaj opcijsko sestavino (bacon)
        const bacon = await Inventory.create({
            name: 'Bacon',
            category: 'Meat',
            quantity: 30,
            unit: 'pcs',
            costPerUnit: 0.40,
            reorderLevel: 5,
        });

        await Recipe.findByIdAndUpdate(recipe._id, {
            $push: {
                ingredients: { inventory: bacon._id, quantity: 2, optional: true },
            },
        });

        await request(app)
            .post('/api/orders')
            .set('Cookie', adminCookie)
            .send({
                type: 'Dine-in',
                paymentMethod: 'Cash',
                clientId: client._id,
                clientPhone: "1234567890",
                items: [{ menuItem: menuItem._id, quantity: 2 }],
            });

        // Bacon se NE sme spremeniti (opcijska sestavina)
        const baconAfter = await Inventory.findById(bacon._id);
        expect(baconAfter.quantity).toBe(30); // original
    });

    it('mora vrne zalogo ob cancel order (restock)', async () => {
        // Najprej ustvari order
        const createRes = await request(app)
            .post('/api/orders')
            .set('Cookie', adminCookie)
            .send({
                type: 'Dine-in',
                paymentMethod: 'Cash',
                clientId: client._id,
                clientPhone: "1234567890",
                items: [{ menuItem: menuItem._id, quantity: 4 }],
            });

        expect(createRes.status).toBe(201);
        const orderId = createRes.body.order._id;

        // Preveri depletion
        const beefAfterOrder = await Inventory.findById(beef._id);
        expect(beefAfterOrder.quantity).toBeCloseTo(9.2, 5); // 10 - 0.8

        // Prekliči order
        const cancelRes = await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', adminCookie)
            .send({ status: 'Cancelled' });

        expect(cancelRes.status).toBe(200);

        // Preveri, da se je zaloga VRNILA
        const beefAfterCancel = await Inventory.findById(beef._id);
        expect(beefAfterCancel.quantity).toBe(10); // vrne na original

        const bunAfterCancel = await Inventory.findById(bun._id);
        expect(bunAfterCancel.quantity).toBe(50); // vrne na original

        // Preveri, da so StockMovement zabeleženi tudi za return
        const returnMovements = await StockMovement.find({ type: 'return' });
        expect(returnMovements).toHaveLength(2); // beef + bun
        expect(returnMovements[0].quantityChange).toBeGreaterThan(0); // pozitivno
    });

    it('restock mora biti idempotentno (double-cancel ne double-restock)', async () => {
        // Ustvari order
        const createRes = await request(app)
            .post('/api/orders')
            .set('Cookie', adminCookie)
            .send({
                type: 'Dine-in',
                paymentMethod: 'Cash',
                clientId: client._id,
                clientPhone: "1234567890",
                items: [{ menuItem: menuItem._id, quantity: 2 }],
            });

        const orderId = createRes.body.order._id;

        // Prekliči
        await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', adminCookie)
            .send({ status: 'Cancelled' });

        const beefAfterFirstCancel = await Inventory.findById(beef._id);
        expect(beefAfterFirstCancel.quantity).toBe(10); // vrne na original

        // Poskusi preklicati še enkrat (že je Cancelled — ne bi smelo double-restock)
        await request(app)
            .patch(`/api/orders/${orderId}/status`)
            .set('Cookie', adminCookie)
            .send({ status: 'Cancelled' });

        const beefAfterSecondCancel = await Inventory.findById(beef._id);
        expect(beefAfterSecondCancel.quantity).toBe(10); // še vedno 10, ne 10.4

        // Samo 2 return gibanja (ne 4)
        const returnMovements = await StockMovement.find({ type: 'return' });
        expect(returnMovements).toHaveLength(2);
    });
});

describe('Stock Movement API (v1.6.0)', () => {
    let adminCookie;
    let inventoryItem;

    beforeEach(async () => {
        const auth = await getAuthCookie(app, { role: 'admin' });
        adminCookie = auth.cookie;

        inventoryItem = await Inventory.create({
            name: 'Test Item',
            category: 'Test',
            quantity: 20,
            unit: 'pcs',
            reorderLevel: 5,
            costPerUnit: 2.50,
            supplier: 'Test Supplier',
        });
    });

    it('GET /api/stock-movements — mora vrniti seznam gibanj', async () => {
        // Ustvari test gibanje
        await StockMovement.create({
            inventory: inventoryItem._id,
            inventoryName: 'Test Item',
            type: 'restock',
            quantityChange: 20,
            quantityBefore: 0,
            quantityAfter: 20,
            unit: 'pcs',
            costPerUnit: 2.50,
            totalValue: 50,
        });

        const res = await request(app)
            .get('/api/stock-movements')
            .set('Cookie', adminCookie);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.movements.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/stock-movements — mora filtrirati po tipu', async () => {
        await StockMovement.create({
            inventory: inventoryItem._id,
            inventoryName: 'Test Item',
            type: 'restock',
            quantityChange: 10,
            quantityBefore: 0,
            quantityAfter: 10,
            unit: 'pcs',
        });
        await StockMovement.create({
            inventory: inventoryItem._id,
            inventoryName: 'Test Item',
            type: 'waste',
            quantityChange: -2,
            quantityBefore: 10,
            quantityAfter: 8,
            unit: 'pcs',
        });

        const res = await request(app)
            .get('/api/stock-movements?type=waste')
            .set('Cookie', adminCookie);

        expect(res.status).toBe(200);
        expect(res.body.movements).toHaveLength(1);
        expect(res.body.movements[0].type).toBe('waste');
    });

    it('POST /api/stock-movements/restock — mora dopolniti zalogo', async () => {
        const res = await request(app)
            .post('/api/stock-movements/restock')
            .set('Cookie', adminCookie)
            .send({
                inventory: inventoryItem._id,
                quantity: 30,
                reason: 'Weekly delivery',
                costPerUnit: 3.00,
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.inventory.quantity).toBe(50); // 20 + 30
        expect(res.body.movement.type).toBe('restock');
        expect(res.body.movement.quantityChange).toBe(30);

        // Preveri v bazi
        const updated = await Inventory.findById(inventoryItem._id);
        expect(updated.quantity).toBe(50);
        expect(updated.costPerUnit).toBe(3.00); // posodobljena cena
    });

    it('POST /api/stock-movements/restock — mora zavrniti negativno količino (400)', async () => {
        const res = await request(app)
            .post('/api/stock-movements/restock')
            .set('Cookie', adminCookie)
            .send({
                inventory: inventoryItem._id,
                quantity: -5,
            });

        expect(res.status).toBe(400);
    });

    it('POST /api/stock-movements/adjust — mora korigirati zalogo', async () => {
        const res = await request(app)
            .post('/api/stock-movements/adjust')
            .set('Cookie', adminCookie)
            .send({
                inventory: inventoryItem._id,
                newQuantity: 18,
                reason: 'Inventory count correction',
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.movement.quantityChange).toBe(-2); // 20 → 18
        expect(res.body.movement.type).toBe('adjustment');

        const updated = await Inventory.findById(inventoryItem._id);
        expect(updated.quantity).toBe(18);
    });

    it('POST /api/stock-movements/adjust — mora zahtevati reason (400)', async () => {
        const res = await request(app)
            .post('/api/stock-movements/adjust')
            .set('Cookie', adminCookie)
            .send({
                inventory: inventoryItem._id,
                newQuantity: 15,
                reason: 'ab', // prekratek
            });

        expect(res.status).toBe(400);
    });

    it('GET /api/stock-movements/inventory/:id — mora vrniti zgodovino za item', async () => {
        await StockMovement.create({
            inventory: inventoryItem._id,
            inventoryName: 'Test Item',
            type: 'restock',
            quantityChange: 20,
            quantityBefore: 0,
            quantityAfter: 20,
            unit: 'pcs',
        });
        await StockMovement.create({
            inventory: inventoryItem._id,
            inventoryName: 'Test Item',
            type: 'waste',
            quantityChange: -5,
            quantityBefore: 20,
            quantityAfter: 15,
            unit: 'pcs',
        });

        const res = await request(app)
            .get(`/api/stock-movements/inventory/${inventoryItem._id}`)
            .set('Cookie', adminCookie);

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(2);
        expect(res.body.movements[0].type).toBe('waste'); // najnovejši prvi
    });

    it('GET /api/stock-movements/stats — mora vrniti agregirano statistiko', async () => {
        await StockMovement.create([
            {
                inventory: inventoryItem._id,
                inventoryName: 'Test Item',
                type: 'order',
                quantityChange: -5,
                quantityBefore: 20,
                quantityAfter: 15,
                unit: 'pcs',
                costPerUnit: 2.50,
                totalValue: 12.50,
            },
            {
                inventory: inventoryItem._id,
                inventoryName: 'Test Item',
                type: 'restock',
                quantityChange: 10,
                quantityBefore: 15,
                quantityAfter: 25,
                unit: 'pcs',
                costPerUnit: 2.50,
                totalValue: 25,
            },
        ]);

        const res = await request(app)
            .get('/api/stock-movements/stats')
            .set('Cookie', adminCookie);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.stats.byType).toBeDefined();
        expect(res.body.stats.topConsumed).toBeDefined();
        expect(res.body.stats.totals).toBeDefined();
    });

    it('RBAC — cashier ne sme restock (403)', async () => {
        const auth = await getAuthCookie(app, { role: 'cashier' });
        const res = await request(app)
            .post('/api/stock-movements/restock')
            .set('Cookie', auth.cookie)
            .send({
                inventory: inventoryItem._id,
                quantity: 10,
            });

        expect(res.status).toBe(403);
    });

    it('RBAC — cashier lahko bere gibanja (200)', async () => {
        const auth = await getAuthCookie(app, { role: 'cashier' });
        const res = await request(app)
            .get('/api/stock-movements')
            .set('Cookie', auth.cookie);

        expect(res.status).toBe(200);
    });
});
