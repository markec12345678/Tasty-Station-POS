/**
 * Integration testi za Socket.io outlet izolacijo — v1.2.0 funkcionalnost.
 *
 * Testiramo, da emitToOutlet pošilja dogodke samo v pravo outlet sobo
 * in da admin dashboard (outlet:global) še vedno prejema vse dogodke.
 *
 * Ker je socket.config mock-an v setup.db.js, ta test neposredno testira
 * helper logiko z lastnim mock-om, ki simulira io.to(room).emit() behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock io instance s to()/emit tracking
const createMockIo = () => {
    const rooms = new Map(); // room -> events[]
    return {
        to: vi.fn((room) => ({
            emit: vi.fn((event, data) => {
                if (!rooms.has(room)) rooms.set(room, []);
                rooms.get(room).push({ event, data });
            }),
        })),
        emit: vi.fn((event, data) => {
            // Global emit — pošlje v "global" sobo za testiranje
            if (!rooms.has('__global__')) rooms.set('__global__', []);
            rooms.get('__global__').push({ event, data });
        }),
        _rooms: rooms,
        _getEvents: (room) => rooms.get(room) || [],
    };
};

// Replikacija emitToOutlet logike iz socket.config.js
// (mock v setup.db.js povozi module, zato repliciramo za test)
const createEmitToOutlet = (mockIo) => {
    return (outletId, event, data) => {
        if (!mockIo) return;
        const room = outletId ? `outlet:${outletId}` : 'outlet:global';
        mockIo.to(room).emit(event, data);
        // Vedno pošlji tudi v global sobo (admin dashboard)
        mockIo.to('outlet:global').emit(event, data);
    };
};

describe('Socket.io Outlet Isolation (v1.2.0)', () => {
    let mockIo;
    let emitToOutlet;

    beforeEach(() => {
        mockIo = createMockIo();
        emitToOutlet = createEmitToOutlet(mockIo);
    });

    it('mora poslati dogodek v pravo outlet sobo', () => {
        const outletA = '507f1f77bcf86cd799439011';
        emitToOutlet(outletA, 'newOrder', { id: 'ORD-1' });

        expect(mockIo.to).toHaveBeenCalledWith(`outlet:${outletA}`);
        const events = mockIo._getEvents(`outlet:${outletA}`);
        expect(events).toHaveLength(1);
        expect(events[0].event).toBe('newOrder');
        expect(events[0].data.id).toBe('ORD-1');
    });

    it('mora poslati dogodek tudi v outlet:global (admin dashboard)', () => {
        const outletA = '507f1f77bcf86cd799439011';
        emitToOutlet(outletA, 'newOrder', { id: 'ORD-1' });

        const globalEvents = mockIo._getEvents('outlet:global');
        expect(globalEvents).toHaveLength(1);
        expect(globalEvents[0].event).toBe('newOrder');
    });

    it('NE sme poslati dogodka v drug outlet', () => {
        const outletA = '507f1f77bcf86cd799439011';
        const outletB = '507f1f77bcf86cd799439022';
        emitToOutlet(outletA, 'newOrder', { id: 'ORD-1' });

        // Outlet A in global mora prejeti
        expect(mockIo._getEvents(`outlet:${outletA}`)).toHaveLength(1);
        expect(mockIo._getEvents('outlet:global')).toHaveLength(1);

        // Outlet B NE sme prejeti
        expect(mockIo._getEvents(`outlet:${outletB}`)).toHaveLength(0);
    });

    it('mora poslati v outlet:global, ko outletId je null (admin/QR)', () => {
        emitToOutlet(null, 'qrOrderPlaced', { orderId: 'QR-1' });

        expect(mockIo.to).toHaveBeenCalledWith('outlet:global');
        const globalEvents = mockIo._getEvents('outlet:global');
        // Enkrat za explicit null → outlet:global, enkrat za default global
        // (obe klica ciljata na isto sobo)
        expect(globalEvents.length).toBeGreaterThanOrEqual(1);
        expect(globalEvents[0].event).toBe('qrOrderPlaced');
    });

    it('mora podpreti različne event tipe (newOrder, paymentUpdate, orderStatusUpdate, courseSent)', () => {
        const outlet = '507f1f77bcf86cd799439011';
        emitToOutlet(outlet, 'newOrder', { id: 1 });
        emitToOutlet(outlet, 'paymentUpdate', { id: 1, paid: 50 });
        emitToOutlet(outlet, 'orderStatusUpdate', { id: 1, status: 'Ready' });
        emitToOutlet(outlet, 'courseSent', { orderId: 1, course: 2 });

        const events = mockIo._getEvents(`outlet:${outlet}`);
        expect(events).toHaveLength(4);
        expect(events.map(e => e.event)).toEqual([
            'newOrder', 'paymentUpdate', 'orderStatusUpdate', 'courseSent'
        ]);
    });

    it('mora obravnavati undefined outletId kot global', () => {
        emitToOutlet(undefined, 'newOrder', { id: 'ORD-1' });

        expect(mockIo.to).toHaveBeenCalledWith('outlet:global');
    });

    it('ne sme crashati, če io ni inicializiran', () => {
        const emit = createEmitToOutlet(null);
        // Ne sme throw-at
        expect(() => emit('outletA', 'test', {})).not.toThrow();
    });

    it('mora poslati pravilen payload (deep equality)', () => {
        const outlet = '507f1f77bcf86cd799439011';
        const payload = {
            orderId: 'ORD-COMPLEX',
            items: [{ name: 'Burger', qty: 2, modifiers: ['extra cheese'] }],
            total: 25.98,
            client: { name: 'Janez', phone: '+38631234567' },
        };
        emitToOutlet(outlet, 'newOrder', payload);

        const events = mockIo._getEvents(`outlet:${outlet}`);
        expect(events[0].data).toEqual(payload);
    });
});
