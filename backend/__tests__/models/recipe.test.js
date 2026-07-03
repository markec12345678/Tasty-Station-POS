/**
 * Testi za Recipe (Bill of Materials) model — v1.3.0 nova funkcionalnost.
 *
 * Recipe je ključen za:
 *   1. Pravo inventory forecasting (nadomešča besedno ujemanje)
 *   2. Recipe costing (koliko stane izdelava jedi)
 *   3. Margin analysis (price - cost = profit)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Recipe from '../../models/recipe.model';
import Inventory from '../../models/inventory.model';
import { Category, MenuItem } from '../../models/menu.model';

describe('Recipe Model (v1.3.0 — Bill of Materials)', () => {
    let menuItem;
    let beef;
    let bun;
    let cheese;

    beforeEach(async () => {
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
            reorderLevel: 10,
            costPerUnit: 8.00, // 8 EUR/kg
            supplier: 'Local Butcher',
        });

        bun = await Inventory.create({
            name: 'Burger Bun',
            category: 'Bakery',
            quantity: 200,
            unit: 'pcs',
            reorderLevel: 20,
            costPerUnit: 0.50, // 0.50 EUR/pcs
            supplier: 'Bakery Inc',
        });

        cheese = await Inventory.create({
            name: 'Cheddar Slice',
            category: 'Dairy',
            quantity: 150,
            unit: 'pcs',
            reorderLevel: 15,
            costPerUnit: 0.30,
            supplier: 'Dairy Co',
        });
    });

    it('mora ustvariti veljaven recept s sestavinami', async () => {
        const recipe = await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [
                { inventory: beef._id, quantity: 0.2, unit: 'kg' },     // 200g beef
                { inventory: bun._id, quantity: 1, unit: 'pcs' },       // 1 bun
                { inventory: cheese._id, quantity: 1, unit: 'pcs' },    // 1 cheese slice
            ],
            instructions: 'Grill patty, melt cheese, assemble.',
            prepTime: 12,
        });

        expect(recipe._id).toBeDefined();
        expect(recipe.menuItem.toString()).toBe(menuItem._id.toString());
        expect(recipe.ingredients).toHaveLength(3);
        expect(recipe.isActive).toBe(true);
        expect(recipe.prepTime).toBe(12);
    });

    it('ne sme dovoliti dveh receptov za isti menu item (unique index)', async () => {
        await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [{ inventory: beef._id, quantity: 0.2 }],
        });

        // Drugi recept za isti menuItem mora pasti na unique index
        await expect(Recipe.create({
            menuItem: menuItem._id,
            ingredients: [{ inventory: bun._id, quantity: 1 }],
        })).rejects.toThrow();
    });

    it('recomputeCost mora pravilno izračunati ceno recepta', async () => {
        // Cheeseburger = 0.2kg beef (8 EUR/kg) + 1 bun (0.50) + 1 cheese (0.30)
        // = 1.60 + 0.50 + 0.30 = 2.40 EUR
        const recipe = await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [
                { inventory: beef._id, quantity: 0.2 },
                { inventory: bun._id, quantity: 1 },
                { inventory: cheese._id, quantity: 1 },
            ],
        });

        const cost = await recipe.recomputeCost();
        expect(cost).toBe(2.40);
        expect(recipe.computedCost).toBe(2.40);
    });

    it('recomputeCost mora ignorirati sestavine z manjkajočo ceno', async () => {
        const noPriceInv = await Inventory.create({
            name: 'Salt',
            category: 'Spices',
            quantity: 50,
            unit: 'kg',
            costPerUnit: null, // brez cene
        });

        const recipe = await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [
                { inventory: beef._id, quantity: 0.2 },    // 1.60
                { inventory: noPriceInv._id, quantity: 0.01 }, // 0 (no price)
            ],
        });

        const cost = await recipe.recomputeCost();
        expect(cost).toBe(1.60);
    });

    it('getConsumptionForPortions mora vrniti pravo porabo za N porcij', async () => {
        const recipe = await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [
                { inventory: beef._id, quantity: 0.2 },     // 200g per burger
                { inventory: bun._id, quantity: 1 },        // 1 per burger
                { inventory: cheese._id, quantity: 1 },     // 1 per burger
            ],
        });

        // Za 10 burgerjev: 2kg beef + 10 bun + 10 cheese
        const consumption = await recipe.getConsumptionForPortions(10);
        expect(consumption).toHaveLength(3);

        const beefUsage = consumption.find(c => c.inventoryName === 'Beef Patty');
        expect(beefUsage.quantityNeeded).toBe(2); // 0.2 * 10
        expect(beefUsage.totalCost).toBe(16);    // 2 * 8

        const bunUsage = consumption.find(c => c.inventoryName === 'Burger Bun');
        expect(bunUsage.quantityNeeded).toBe(10);
        expect(bunUsage.totalCost).toBe(5);      // 10 * 0.50
    });

    it('getConsumptionForPortions mora izpustiti opcijske sestavine', async () => {
        const bacon = await Inventory.create({
            name: 'Bacon Strip',
            category: 'Meat',
            quantity: 80,
            unit: 'pcs',
            costPerUnit: 0.40,
        });

        const recipe = await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [
                { inventory: beef._id, quantity: 0.2, optional: false },
                { inventory: bun._id, quantity: 1, optional: false },
                { inventory: bacon._id, quantity: 2, optional: true }, // opcijska
            ],
        });

        const consumption = await recipe.getConsumptionForPortions(5);
        expect(consumption).toHaveLength(2); // bacon je opcijska, izpusti
        expect(consumption.find(c => c.inventoryName === 'Bacon Strip')).toBeUndefined();
    });

    it('getConsumptionForPortions mora vrniti prazno tabelo za 0 porcij', async () => {
        const recipe = await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [{ inventory: beef._id, quantity: 0.2 }],
        });

        const consumption = await recipe.getConsumptionForPortions(0);
        expect(consumption).toEqual([]);

        const consumption2 = await recipe.getConsumptionForPortions(-5);
        expect(consumption2).toEqual([]);
    });

    it('mora podpreti soft delete (isActive = false)', async () => {
        const recipe = await Recipe.create({
            menuItem: menuItem._id,
            ingredients: [{ inventory: beef._id, quantity: 0.2 }],
        });

        expect(recipe.isActive).toBe(true);

        recipe.isActive = false;
        await recipe.save();

        const found = await Recipe.findOne({ menuItem: menuItem._id, isActive: true });
        expect(found).toBeNull();
    });
});
