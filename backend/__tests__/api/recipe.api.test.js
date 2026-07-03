/**
 * Testi za Recipe API (CRUD + costing) — v1.3.0 nova funkcionalnost.
 *
 * Endpointi:
 *   GET    /api/recipes               — seznam receptov
 *   GET    /api/recipes/:menuItemId   — recept za specifičen menu item
 *   POST   /api/recipes               — upsert (en recept na menu item)
 *   DELETE /api/recipes/:id           — soft delete
 *   GET    /api/recipes/:menuItemId/cost — recipe costing (margin, profit)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../index';
import { Category, MenuItem } from '../../models/menu.model';
import Inventory from '../../models/inventory.model';
import Recipe from '../../models/recipe.model';
import { getAuthCookie } from './test.utils';

describe('Recipe API (v1.3.0 — CRUD + Costing)', () => {
    let adminCookie;
    let menuItem;
    let beef;
    let bun;

    beforeEach(async () => {
        const auth = await getAuthCookie(app, { role: 'admin' });
        adminCookie = auth.cookie;

        const cat = await Category.create({ name: 'Burgers', description: 'Burger dishes' });
        menuItem = await MenuItem.create({
            name: 'Cheeseburger',
            price: 12.99,
            costPrice: 4.50,
            category: cat._id,
        });

        beef = await Inventory.create({
            name: 'Beef Patty',
            category: 'Meat',
            quantity: 100,
            unit: 'kg',
            costPerUnit: 8.00,
            reorderLevel: 10,
            supplier: 'Butcher',
        });

        bun = await Inventory.create({
            name: 'Burger Bun',
            category: 'Bakery',
            quantity: 200,
            unit: 'pcs',
            costPerUnit: 0.50,
            reorderLevel: 20,
            supplier: 'Bakery',
        });
    });

    it('POST /api/recipes — mora ustvariti nov recept', async () => {
        const res = await request(app)
            .post('/api/recipes')
            .set('Cookie', adminCookie)
            .send({
                menuItem: menuItem._id,
                ingredients: [
                    { inventory: beef._id, quantity: 0.2 },
                    { inventory: bun._id, quantity: 1 },
                ],
                instructions: 'Grill and assemble.',
                prepTime: 10,
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.recipe.menuItem).toBeDefined();
        expect(res.body.recipe.ingredients).toHaveLength(2);
        expect(res.body.recipe.computedCost).toBeGreaterThan(0);
    });

    it('POST /api/recipes — mora zavrniti recept brez menuItem (400)', async () => {
        const res = await request(app)
            .post('/api/recipes')
            .set('Cookie', adminCookie)
            .send({
                ingredients: [{ inventory: beef._id, quantity: 0.2 }],
            });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('POST /api/recipes — mora zavrniti recept brez sestavin (400)', async () => {
        const res = await request(app)
            .post('/api/recipes')
            .set('Cookie', adminCookie)
            .send({
                menuItem: menuItem._id,
                ingredients: [],
            });

        expect(res.status).toBe(400);
    });

    it('POST /api/recipes — mora zavrniti sestavino z negativno količino (400)', async () => {
        const res = await request(app)
            .post('/api/recipes')
            .set('Cookie', adminCookie)
            .send({
                menuItem: menuItem._id,
                ingredients: [{ inventory: beef._id, quantity: -0.5 }],
            });

        expect(res.status).toBe(400);
    });

    it('POST /api/recipes — mora zavrniti sestavino z neobstoječim inventory ID (404)', async () => {
        const fakeId = new (require('mongoose').Types.ObjectId)();
        const res = await request(app)
            .post('/api/recipes')
            .set('Cookie', adminCookie)
            .send({
                menuItem: menuItem._id,
                ingredients: [{ inventory: fakeId, quantity: 0.2 }],
            });

        expect(res.status).toBe(404);
    });

    it('POST /api/recipes — mora zavrniti neobstoječ menuItem (404)', async () => {
        const fakeMenuId = new (require('mongoose').Types.ObjectId)();
        const res = await request(app)
            .post('/api/recipes')
            .set('Cookie', adminCookie)
            .send({
                menuItem: fakeMenuId,
                ingredients: [{ inventory: beef._id, quantity: 0.2 }],
            });

        expect(res.status).toBe(404);
    });

    it('POST /api/recipes — mora upsert-ati (posodobiti) obstoječi recept', async () => {
        // Prvi POST — kreiraj
        await request(app)
            .post('/api/recipes')
            .set('Cookie', adminCookie)
            .send({
                menuItem: menuItem._id,
                ingredients: [{ inventory: beef._id, quantity: 0.2 }],
            });

        // Drugi POST — posodobi z drugačnimi sestavinami
        const res2 = await request(app)
            .post('/api/recipes')
            .set('Cookie', adminCookie)
            .send({
                menuItem: menuItem._id,
                ingredients: [
                    { inventory: beef._id, quantity: 0.25 }, // več
                    { inventory: bun._id, quantity: 1 },     // dodan bun
                ],
            });

        expect(res2.status).toBe(201);
        expect(res2.body.recipe.ingredients).toHaveLength(2);

        // Preveri, da ni duplikata
        const count = await Recipe.countDocuments({ menuItem: menuItem._id, isActive: true });
        expect(count).toBe(1);
    });

    it('GET /api/recipes — mora vrniti seznam receptov', async () => {
        await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [{ inventory: beef._id, quantity: 0.2 }],
        });

        const res = await request(app)
            .get('/api/recipes')
            .set('Cookie', adminCookie);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBeGreaterThanOrEqual(1);
        expect(res.body.recipes[0].menuItem).toBeDefined();
    });

    it('GET /api/recipes/:menuItemId — mora vrniti recept za menu item', async () => {
        await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [{ inventory: beef._id, quantity: 0.2 }],
        });

        const res = await request(app)
            .get(`/api/recipes/${menuItem._id}`)
            .set('Cookie', adminCookie);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.recipe.menuItem._id.toString()).toBe(menuItem._id.toString());
    });

    it('GET /api/recipes/:menuItemId — mora vrniti 404 če recept ne obstaja', async () => {
        const res = await request(app)
            .get(`/api/recipes/${menuItem._id}`)
            .set('Cookie', adminCookie);

        expect(res.status).toBe(404);
    });

    it('GET /api/recipes/:menuItemId/cost — mora vrniti recipe costing z maržo', async () => {
        // Cheeseburger: 0.2kg beef (8/kg) + 1 bun (0.50) = 1.60 + 0.50 = 2.10 cost
        // Sale price: 12.99 → profit = 10.89, margin = 83.83%
        await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [
                { inventory: beef._id, quantity: 0.2 },
                { inventory: bun._id, quantity: 1 },
            ],
        });

        const res = await request(app)
            .get(`/api/recipes/${menuItem._id}/cost`)
            .set('Cookie', adminCookie);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.costing.computedCost).toBe(2.10);
        expect(res.body.costing.salePrice).toBe(12.99);
        expect(res.body.costing.grossProfit).toBe(10.89);
        expect(res.body.costing.marginPercent).toBeGreaterThan(80);
        expect(res.body.costing.ingredients).toHaveLength(2);
    });

    it('GET /api/recipes/:menuItemId/cost — mora vrniti 404 če recept ne obstaja', async () => {
        const res = await request(app)
            .get(`/api/recipes/${menuItem._id}/cost`)
            .set('Cookie', adminCookie);

        expect(res.status).toBe(404);
    });

    it('DELETE /api/recipes/:id — mora soft-delete recept (isActive=false)', async () => {
        const recipe = await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [{ inventory: beef._id, quantity: 0.2 }],
        });

        const res = await request(app)
            .delete(`/api/recipes/${recipe._id}`)
            .set('Cookie', adminCookie);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Preveri, da je isActive = false
        const deleted = await Recipe.findById(recipe._id);
        expect(deleted.isActive).toBe(false);

        // In da GET / vrne 0 aktivnih
        const listRes = await request(app)
            .get('/api/recipes')
            .set('Cookie', adminCookie);
        expect(listRes.body.count).toBe(0);
    });

    it('RBAC — cashier ne sme ustvarjati receptov (403)', async () => {
        const auth = await getAuthCookie(app, { role: 'cashier' });
        const res = await request(app)
            .post('/api/recipes')
            .set('Cookie', auth.cookie)
            .send({
                menuItem: menuItem._id,
                ingredients: [{ inventory: beef._id, quantity: 0.2 }],
            });

        expect(res.status).toBe(403);
    });

    it('RBAC — cashier lahko bere recepte (200)', async () => {
        await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [{ inventory: beef._id, quantity: 0.2 }],
        });

        const auth = await getAuthCookie(app, { role: 'cashier' });
        const res = await request(app)
            .get('/api/recipes')
            .set('Cookie', auth.cookie);

        expect(res.status).toBe(200);
    });
});
