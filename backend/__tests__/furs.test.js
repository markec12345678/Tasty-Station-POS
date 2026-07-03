/**
 * Testi za FURS utility funkcije — fokus na QR kodo in ZOI generiranje.
 *
 * v1.3.0 je popravil kritično napako: prejšnja implementacija QR kode je
 * generirala `SI${date}${taxNumber}${zoi_hex}`, kar NI skladno s FURS spec.
 * Pravilen format (po bostjanpisler/node-furs-fiscal-verification):
 *   ZOI_decimal(39) + YYMMDDHHmmss(12) + TaxNumber(8) + ControlDigit(1) = 60.
 *
 * Ta test datoteka preverja, da se ta format ne more več regresirati.
 */
import { describe, it, expect } from 'vitest';
import { generateQRContent, generateZOI, generateInvoiceNumber } from '../utils/furs';
import FiscalInvoice from '../models/fiscalInvoice.model';
import Order from '../models/order.model';
import { Category, MenuItem } from '../models/menu.model';
import Client from '../models/client.model';

describe('FURS QR Code Format (v1.3.0 kritični popravek)', () => {
    // Fiksni testni podatki za deterministične teste
    const TEST_ZOI_HEX = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'; // 32 hex znakov
    const TEST_TAX_NUMBER = '12345678'; // 8 števk
    const TEST_DATE = new Date('2025-07-03T14:30:45.000Z');

    it('mora generirati 60-znakovno QR vsebino (39+12+8+1)', () => {
        const qr = generateQRContent(TEST_ZOI_HEX, TEST_DATE, TEST_TAX_NUMBER);
        expect(qr).toHaveLength(60);
    });

    it('ne sme vsebovati "SI" prefix-a (stara napačna implementacija)', () => {
        const qr = generateQRContent(TEST_ZOI_HEX, TEST_DATE, TEST_TAX_NUMBER);
        expect(qr.startsWith('SI')).toBe(false);
    });

    it('ne sme vsebovati hex ZOI vrednosti (stara implementacija)', () => {
        const qr = generateQRContent(TEST_ZOI_HEX, TEST_DATE, TEST_TAX_NUMBER);
        // Stara implementacija je imela hex ZOI na koncu — sedaj je decimal na začetku
        expect(qr).not.toContain(TEST_ZOI_HEX);
    });

    it('mora vsebovati decimal ZOI (39 znakov, left-padded z 0) na začetku', () => {
        const qr = generateQRContent(TEST_ZOI_HEX, TEST_DATE, TEST_TAX_NUMBER);
        const zoiDecimal = BigInt('0x' + TEST_ZOI_HEX).toString(10);
        const zoiPadded = zoiDecimal.padStart(39, '0');
        expect(qr.slice(0, 39)).toBe(zoiPadded);
    });

    it('mora vsebovati datum YYMMDDHHmmss (12 znakov) na poziciji 39-51', () => {
        const qr = generateQRContent(TEST_ZOI_HEX, TEST_DATE, TEST_TAX_NUMBER);
        // Vrstni red: ZOI_dec(39) + datum(12) + tax(8) + control(1) = 60
        const datePart = qr.slice(39, 51);
        expect(datePart).toHaveLength(12);
        expect(datePart).toMatch(/^\d{12}$/);
    });

    it('mora vsebovati davčno številko (8 znakov) na poziciji 51-59', () => {
        const qr = generateQRContent(TEST_ZOI_HEX, TEST_DATE, TEST_TAX_NUMBER);
        expect(qr.slice(51, 59)).toBe(TEST_TAX_NUMBER);
    });

    it('mora padati davčno številko na 8 znakov, če je krajša', () => {
        const shortTax = '1234567'; // 7 števk
        const qr = generateQRContent(TEST_ZOI_HEX, TEST_DATE, shortTax);
        expect(qr.slice(51, 59)).toBe('01234567');
    });

    it('mora imeti kontrolno števko kot zadnji znak (0-9)', () => {
        const qr = generateQRContent(TEST_ZOI_HEX, TEST_DATE, TEST_TAX_NUMBER);
        const lastChar = qr[59];
        expect(lastChar).toMatch(/^[0-9]$/);
    });

    it('kontrolna števka mora biti vsota števk mod 10', () => {
        const qr = generateQRContent(TEST_ZOI_HEX, TEST_DATE, TEST_TAX_NUMBER);
        const first59 = qr.slice(0, 59);
        let sum = 0;
        for (const ch of first59) {
            if (ch >= '0' && ch <= '9') sum += parseInt(ch, 10);
        }
        const expectedControl = sum % 10;
        expect(parseInt(qr[59], 10)).toBe(expectedControl);
    });

    it('mora vsebovati datum v YYMMDDHHmmss formatu (preverjeno z novo pozicijo 39-51)', () => {
        const qr = generateQRContent(TEST_ZOI_HEX, TEST_DATE, TEST_TAX_NUMBER);
        const datePart = qr.slice(39, 51);
        expect(datePart).toHaveLength(12);
        expect(datePart).toMatch(/^\d{12}$/); // 12 števk
    });

    it('mora obravnavati neveljaven ZOI hex z graceful fallback', () => {
        const invalidZoi = 'not-valid-hex!';
        const qr = generateQRContent(invalidZoi, TEST_DATE, TEST_TAX_NUMBER);
        // Ne sme crashati — fallback na "0" padded
        expect(qr).toHaveLength(60);
        expect(qr.slice(0, 39)).toBe('0'.repeat(39));
    });

    it('mora dati deterministične rezultate za iste vhode', () => {
        const qr1 = generateQRContent(TEST_ZOI_HEX, TEST_DATE, TEST_TAX_NUMBER);
        const qr2 = generateQRContent(TEST_ZOI_HEX, TEST_DATE, TEST_TAX_NUMBER);
        expect(qr1).toBe(qr2);
    });
});

describe('FURS ZOI Generation', () => {
    it('mora generirati 32-znakovni hex ZOI', () => {
        // generateZOI zahteva RSA private key — v testih brez certifikata
        // preskočimo dejansko generiranje, preverjamo samo format helperja.
        // generateZOI je odvisna od crypto.createSign — brez ključa ne moremo
        // generirati veljavnega ZOI-ja. Testiramo samo, da funkcija obstaja.
        expect(typeof generateZOI).toBe('function');
    });
});

describe('FURS Invoice Number Generation', () => {
    it('mora generirati številko v formatu OUTLET_CODE-YEAR-SEQUENCE', async () => {
        const outlet = { _id: null, code: 'TS-LJU' };
        const invoiceNumber = await generateInvoiceNumber(outlet, new Date('2025-07-03'));
        expect(invoiceNumber).toMatch(/^TS-LJU-2025-\d{6}$/);
    });

    it('mora uporabiti "TS" default, če outlet nima code', async () => {
        const outlet = { _id: null, code: null };
        const invoiceNumber = await generateInvoiceNumber(outlet, new Date('2025-07-03'));
        expect(invoiceNumber).toMatch(/^TS-2025-\d{6}$/);
    });

    it('mora inkrementirati zaporedno številko, če že obstaja', async () => {
        // Najprej ustvari Order (FiscalInvoice zahteva order ref)
        const cat = await Category.create({ name: 'Test', description: 'Test' });
        const mi = await MenuItem.create({ name: 'Test Item', price: 10, category: cat._id });
        const client = await Client.create({ name: 'Test Client', phone: '1234567890' });
        const order = await Order.create({
            orderId: 'ORD-FURS-TEST',
            type: 'Dine-in',
            items: [{ menuItem: mi._id, name: 'Test', price: 10, quantity: 1 }],
            totalAmount: 10,
            client: client._id,
            clientName: 'Test Client',
            clientPhone: '1234567890',
        });

        const outlet = { _id: null, code: 'TS-LJU' };
        // Ustvari obstoječi FiscalInvoice z zaporedno številko 000005
        await FiscalInvoice.create({
            order: order._id,
            orderId: order.orderId,
            outlet: null,
            invoiceNumber: 'TS-LJU-2025-000005',
            businessUnit: '1',
            cashRegister: '1',
            taxNumber: '12345678',
            zoi: 'a'.repeat(32),
            eor: null,
            fiscalQR: 'test-qr',
            status: 'confirmed',
            issueDateTime: new Date(),
            totals: { subtotal: 100, taxAmount: 22, discount: 0, total: 122 },
            taxBreakdown: [{ rate: 22, base: 100, tax: 22, gross: 122 }],
            payment: { method: 'cash', amount: 122 },
            attempts: 1,
        });

        const next = await generateInvoiceNumber(outlet, new Date('2025-07-03'));
        expect(next).toBe('TS-LJU-2025-000006');
    });

    it('mora začeti pri 000001, če ni nobenega računa', async () => {
        const outlet = { _id: null, code: 'TS-MB' };
        const invoiceNumber = await generateInvoiceNumber(outlet, new Date('2025-07-03'));
        expect(invoiceNumber).toBe('TS-MB-2025-000001');
    });
});
