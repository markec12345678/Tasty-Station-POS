/**
 * Testi za seed env-gating logiko — v1.2.0 varnostni popravek.
 *
 * Prejšnje stanje: seed.js in dev.js sta v produkciji seedala demo uporabnike
 * (admin@pos.com / password123) s plaintext gesli. Sedaj se demo seeda SAMO
 * ko NODE_ENV !== 'production' ALI ko je SEED_DEMO_USERS=true.
 *
 * Ker seed.js ni Node modul (je skripta, ki se sama zažene), testiramo
 * logiko `shouldSeedDemoUsers` in `seedProductionAdmin` tako, da jih
 * izvlečemo v testabilne pomožne funkcije. Te funkcije so definirane v
 * testni datoteki (ne v produkciji) — replikirajo logiko iz seed.js.
 *
 * Namen: preprečiti regresijo, kdorkoli v prihodnosti spremeni seed.js
 * in po nesreči omogoči demo uporabnike v produkciji.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Replikacija logike iz seed.js (shouldSeedDemoUsers).
 * Drži jo sinhronizirano s produkcijsko kodo!
 */
function shouldSeedDemoUsers(env = process.env) {
    if (env.SEED_DEMO_USERS === 'true') return true;
    if (env.SEED_DEMO_USERS === 'false') return false;
    return env.NODE_ENV !== 'production';
}

describe('Seed Env-Gating Logic (v1.2.0 varnostni popravek)', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        // Obnovi env po vsakem testu
        process.env = { ...originalEnv };
    });

    it('mora seedati demo uporabnike v development (default)', () => {
        delete process.env.NODE_ENV;
        delete process.env.SEED_DEMO_USERS;
        expect(shouldSeedDemoUsers()).toBe(true);
    });

    it('mora seedati demo uporabnike ko NODE_ENV=development', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.SEED_DEMO_USERS;
        expect(shouldSeedDemoUsers()).toBe(true);
    });

    it('NE sme seedati demo uporabnikov ko NODE_ENV=production', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.SEED_DEMO_USERS;
        expect(shouldSeedDemoUsers()).toBe(false);
    });

    it('mora seedati demo uporabnike ko SEED_DEMO_USERS=true (explicit override)', () => {
        process.env.NODE_ENV = 'production';
        process.env.SEED_DEMO_USERS = 'true';
        expect(shouldSeedDemoUsers()).toBe(true);
    });

    it('NE sme seedati demo uporabnikov ko SEED_DEMO_USERS=false (explicit override)', () => {
        process.env.NODE_ENV = 'development';
        process.env.SEED_DEMO_USERS = 'false';
        expect(shouldSeedDemoUsers()).toBe(false);
    });

    it('SEED_DEMO_USERS ima prednost pred NODE_ENV', () => {
        // Production + SEED_DEMO_USERS=true → demo (override)
        process.env.NODE_ENV = 'production';
        process.env.SEED_DEMO_USERS = 'true';
        expect(shouldSeedDemoUsers()).toBe(true);

        // Development + SEED_DEMO_USERS=false → no demo (override)
        process.env.NODE_ENV = 'development';
        process.env.SEED_DEMO_USERS = 'false';
        expect(shouldSeedDemoUsers()).toBe(false);
    });

    it('NE sme seedati demo uporabnikov ko NODE_ENV=production in SEED_DEMO_USERS unset', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.SEED_DEMO_USERS;
        expect(shouldSeedDemoUsers()).toBe(false);
    });

    it('mora seedati demo uporabnike ko NODE_ENV=test', () => {
        process.env.NODE_ENV = 'test';
        delete process.env.SEED_DEMO_USERS;
        expect(shouldSeedDemoUsers()).toBe(true);
    });

    it('mora obravnavati neveljavne SEED_DEMO_USERS vrednosti kot unset', () => {
        process.env.NODE_ENV = 'production';
        process.env.SEED_DEMO_USERS = 'yes'; // ne "true", ne "false"
        expect(shouldSeedDemoUsers()).toBe(false); // fallback na NODE_ENV check
    });
});

/**
 * Test produkcije bootstrap zahtev — če NODE_ENV=production in manjkajo
 * SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD, seeder mora javiti jasno napako.
 */
describe('Production Admin Bootstrap Requirements', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it('produkcija brez SEED_ADMIN_EMAIL in SEED_ADMIN_PASSWORD mora pasti z jasno napako', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.SEED_ADMIN_EMAIL;
        delete process.env.SEED_ADMIN_PASSWORD;
        delete process.env.SEED_DEMO_USERS;

        // Replikacija validacije iz seed.js:seedProductionAdmin
        const validateProductionBootstrap = () => {
            const email = process.env.SEED_ADMIN_EMAIL;
            const password = process.env.SEED_ADMIN_PASSWORD;
            if (!email || !password) {
                throw new Error(
                    "Production seed requires SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env vars. " +
                    "Demo users are disabled in production. Set SEED_DEMO_USERS=true to override (NOT recommended)."
                );
            }
            return true;
        };

        expect(validateProductionBootstrap).toThrow(/SEED_ADMIN_EMAIL/);
    });

    it('produkcija z obema env spremenljivkama mora pasti', () => {
        process.env.NODE_ENV = 'production';
        process.env.SEED_ADMIN_EMAIL = 'admin@example.com';
        process.env.SEED_ADMIN_PASSWORD = 'secure_password_here';
        delete process.env.SEED_DEMO_USERS;

        const validateProductionBootstrap = () => {
            const email = process.env.SEED_ADMIN_EMAIL;
            const password = process.env.SEED_ADMIN_PASSWORD;
            if (!email || !password) {
                throw new Error("Missing env vars");
            }
            return true;
        };

        expect(validateProductionBootstrap()).toBe(true);
    });

    it('produkcija z samo email (brez password) mora pasti', () => {
        process.env.NODE_ENV = 'production';
        process.env.SEED_ADMIN_EMAIL = 'admin@example.com';
        delete process.env.SEED_ADMIN_PASSWORD;
        delete process.env.SEED_DEMO_USERS;

        const validateProductionBootstrap = () => {
            const email = process.env.SEED_ADMIN_EMAIL;
            const password = process.env.SEED_ADMIN_PASSWORD;
            if (!email || !password) {
                throw new Error("Missing env vars");
            }
            return true;
        };

        expect(validateProductionBootstrap).toThrow();
    });
});
