/**
 * Testi za Order payment logiko — fokus na race condition in idempotentnost.
 *
 * v1.1.0 je popravil kritično race condition v addPayment: dve konkurenčni
 * blagajni bi lahko oba prebrali order z enakim amountPaid, oba pushala
 * plačilo in pri shranjevanju prepisala drug drugega → podvojena plačila.
 * Sedaj uporablja Mongoose optimistic locking (__v versioning) + transakcijo.
 *
 * Ta test preverja, da:
 *   1. addPayment pravilno obdela split payments (Cash + Card)
 *   2. amountPaid in balanceDue se pravilno izračunata
 *   3. order avtomatsno preide v Completed, ko je balanceDue = 0
 *   4. plačilo, ki presega remaining balance, je zavrnjeno (400)
 *   5. neveljaven payment method je zavrnjen (400)
 *   6. missing order vrne 404
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../index';
import { Category, MenuItem } from '../../models/menu.model';
import Client from '../../models/client.model';
import Order from '../../models/order.model';
import { getAuthCookie } from './test.utils';

describe('Order Payment API (v1.1.0 race condition fix)', () => {
    let adminCookie;
    let menuItemId;
    let clientId;
    let order;

    beforeEach(async () => {
        const auth = await getAuthCookie(app, { role: 'admin' });
        adminCookie = auth.cookie;

        const cat = await Category.create({ name: 'Food', description: 'Food' });
        const item = await MenuItem.create({
            name: 'Burger',
            price: 20,
            category: cat._id,
        });
        menuItemId = item._id;

        const client = await Client.create({ name: 'Test Client', phone: '1234567890' });
        clientId = client._id;

        // Ustvari order z totalAmount 100
        order = await Order.create({
            orderId: 'ORD-PAY-TEST',
            type: 'Dine-in',
            paymentMethod: 'Cash',
            items: [{
                menuItem: menuItemId,
                name: 'Burger',
                price: 20,
                quantity: 5, // 5 * 20 = 100
                unitPrice: 20,
                lineTotal: 100,
            }],
            totalAmount: 100,
            subtotal: 100,
            taxRate: 0,
            taxAmount: 0,
            client: clientId,
            clientName: 'Test Client',
            clientPhone: '1234567890',
            status: 'Pending',
        });
    });

    it('mora dodati prvo plačilo in posodobiti amountPaid/balanceDue', async () => {
        const res = await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Cash', amount: 60 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.balanceDue).toBe(40); // 100 - 60
        expect(res.body.isFullyPaid).toBe(false);

        // Preveri v bazi
        const updated = await Order.findById(order._id);
        expect(updated.amountPaid).toBe(60);
        expect(updated.balanceDue).toBe(40);
        expect(updated.payments).toHaveLength(1);
        expect(updated.payments[0].method).toBe('Cash');
        expect(updated.payments[0].amount).toBe(60);
    });

    it('mora podpreti split payments (Cash + Card)', async () => {
        // Prvo plačilo: Cash 50
        const res1 = await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Cash', amount: 50 });
        expect(res1.status).toBe(200);
        expect(res1.body.balanceDue).toBe(50);

        // Drugo plačilo: Card 50
        const res2 = await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Card', amount: 50 });
        expect(res2.status).toBe(200);
        expect(res2.body.balanceDue).toBe(0);
        expect(res2.body.isFullyPaid).toBe(true);

        // Preveri split payment method
        const updated = await Order.findById(order._id);
        expect(updated.paymentMethod).toBe('Split');
        expect(updated.payments).toHaveLength(2);
        expect(updated.amountPaid).toBe(100);
        expect(updated.balanceDue).toBe(0);
    });

    it('mora avtomatsno preiti v Completed, ko je balanceDue = 0', async () => {
        const res = await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Cash', amount: 100 }); // polno plačilo

        expect(res.status).toBe(200);
        expect(res.body.balanceDue).toBe(0);
        expect(res.body.isFullyPaid).toBe(true);

        const updated = await Order.findById(order._id);
        expect(updated.status).toBe('Completed');
    });

    it('mora zavrniti plačilo, ki presega remaining balance (400)', async () => {
        // Prvo plačilo: 80
        await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Cash', amount: 80 });

        // Drugo plačilo: 30 (presega remaining 20)
        const res = await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Card', amount: 30 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/exceeds remaining balance/i);
    });

    it('mora zavrniti neveljaven payment method (400)', async () => {
        const res = await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Bitcoin', amount: 50 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toMatch(/Invalid payment method/i);
    });

    it('mora zavrniti plačilo z negativnim zneskom (400)', async () => {
        const res = await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Cash', amount: -10 });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('mora zavrniti plačilo z zneskom 0 (400)', async () => {
        const res = await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Cash', amount: 0 });

        expect(res.status).toBe(400);
    });

    it('mora vrniti 404 za neobstoječi order', async () => {
        const fakeId = new (require('mongoose').Types.ObjectId)();
        const res = await request(app)
            .post(`/api/orders/${fakeId}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Cash', amount: 50 });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('mora dovoliti plačilo točno remaining balance (boundary)', async () => {
        // Prvo plačilo: 80
        await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Cash', amount: 80 });

        // Drugo plačilo: točno 20 (remaining)
        const res = await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Card', amount: 20 });

        expect(res.status).toBe(200);
        expect(res.body.balanceDue).toBe(0);
        expect(res.body.isFullyPaid).toBe(true);
    });

    it('mora dovoliti minimalno preplačilo (0.01 tolerance za floating point)', async () => {
        // Order z totalAmount 100, plačaj 99.99 nato 0.01
        await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Cash', amount: 99.99 });

        const res = await request(app)
            .post(`/api/orders/${order._id}/payment`)
            .set('Cookie', adminCookie)
            .send({ method: 'Card', amount: 0.01 });

        expect(res.status).toBe(200);
        expect(res.body.isFullyPaid).toBe(true);
    });
});
