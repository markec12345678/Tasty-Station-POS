const Inventory = require("../models/inventory.model");
const Recipe = require("../models/recipe.model");
const StockMovement = require("../models/stockMovement.model");

/**
 * Stock depletion helper — avtomatsko zmanjša zalogo ob createOrder.
 *
 * Za vsak order item poišče Recipe (BoM) in za vsako sestavino:
 *   1. Preveri, ali je dovolj zaloge (če ne, throw ApiError → transakcija rollback)
 *   2. Zmanjša Inventory.quantity
 *   3. Zabeleži StockMovement (type="order") za audit trail
 *
 * Če recept manjka za menu item, se zaloga NE spremeni (graceful — recepti so
 * opcijski dokler se ne vnesejo). To je eksplicitno, ker drugače ne bi mogli
 * ustvarjati naročil za menu item-e brez receptov.
 *
 * @param {Array} validItems — order items iz createOrder (vsak ima menuItem, name, quantity)
 * @param {Object} options — { order, outlet, user, session }
 * @returns {Object} { movements: StockMovement[], lowStockAlerts: [] }
 */
const depleteStockForOrder = async (validItems, options = {}) => {
    const { order, outlet, user, session } = options;
    const movements = [];
    const lowStockAlerts = [];

    // Pridobi vse recepte za menu item-e v tem order-u (en poizvedba)
    const menuItemIds = validItems.map(i => i.menuItem);
    const recipes = await Recipe.find({
        menuItem: { $in: menuItemIds },
        isActive: true,
    }).populate("ingredients.inventory", "name unit costPerUnit quantity reorderLevel").session(session);

    const recipeMap = new Map();
    for (const r of recipes) {
        recipeMap.set(String(r.menuItem), r);
    }

    // Za vsak order item — najdi recept in deplete sestavine
    for (const item of validItems) {
        const recipe = recipeMap.get(String(item.menuItem));
        if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
            // Brez recepta — preskoči (graceful)
            continue;
        }

        for (const ing of recipe.ingredients) {
            if (ing.optional || !ing.inventory) continue;

            const inv = ing.inventory;
            const needed = ing.quantity * item.quantity;

            // Preveri zadostnost zaloge
            if (inv.quantity < needed) {
                const err = new Error(
                    `Insufficient stock for "${inv.name}": need ${needed} ${ing.unit || inv.unit}, ` +
                    `have ${inv.quantity} ${inv.unit}. Please restock or adjust the order.`
                );
                err.statusCode = 409;
                err.code = "INSUFFICIENT_STOCK";
                throw err;
            }

            const quantityBefore = inv.quantity;
            const quantityAfter = quantityBefore - needed;

            // Posodobi inventory (uporabi $inc za atomicnost znotraj transakcije)
            await Inventory.updateOne(
                { _id: inv._id },
                { $inc: { quantity: -needed } }
            ).session(session);

            // Zabeleži StockMovement za audit trail
            const movement = await StockMovement.create([{
                inventory: inv._id,
                inventoryName: inv.name,
                type: "order",
                quantityChange: -needed,
                quantityBefore,
                quantityAfter,
                unit: ing.unit || inv.unit,
                order: order?._id || null,
                menuItem: item.menuItem,
                menuItemName: item.name,
                outlet: outlet || null,
                user: user?._id || null,
                userName: user?.name || null,
                costPerUnit: inv.costPerUnit || 0,
                totalValue: Math.round(needed * (inv.costPerUnit || 0) * 100) / 100,
            }], { session });

            movements.push(movement[0]);

            // Low-stock alert — če je zaloga po depletion-u padla pod reorder level
            if (quantityAfter <= inv.reorderLevel) {
                lowStockAlerts.push({
                    inventory: inv._id,
                    name: inv.name,
                    currentStock: quantityAfter,
                    reorderLevel: inv.reorderLevel,
                    unit: inv.unit,
                });
            }
        }
    }

    return { movements, lowStockAlerts };
};

/**
 * Restock helper — vrne zalogo ob preklicu orderja.
 *
 * Poišče vse StockMovement zabeležke z type="order" za ta order in za vsako
 * ustvari ustrezen type="return" gibanje, ki vrne količino nazaj v zalogo.
 *
 * Idempotentno: če že obstajajo type="return" gibanja za ta order, preskoči.
 *
 * @param {Object} order — Order dokument
 * @param {Object} user — uporabnik, ki je preklical
 * @returns {Object} { restocked: Number, movements: StockMovement[] }
 */
const restockForCancelledOrder = async (order, user = null) => {
    // Preveri, ali smo že restock-ali (idempotentnost)
    const existingReturns = await StockMovement.countDocuments({
        order: order._id,
        type: "return",
    });
    if (existingReturns > 0) {
        return { restocked: 0, movements: [], alreadyRestocked: true };
    }

    // Poišči vse originalne depletion gibanja za ta order
    const originalMovements = await StockMovement.find({
        order: order._id,
        type: "order",
    });

    const movements = [];
    for (const orig of originalMovements) {
        // Pridobi trenutno zalogo
        const inv = await Inventory.findById(orig.inventory);
        if (!inv) continue; // inventory morda izbrisan

        const returnQty = Math.abs(orig.quantityChange); // pozitivna količina za vrnitev
        const quantityBefore = inv.quantity;
        const quantityAfter = quantityBefore + returnQty;

        // Vrni zalogo
        await Inventory.updateOne(
            { _id: inv._id },
            { $inc: { quantity: returnQty } }
        );

        // Zabeleži return gibanje
        const movement = await StockMovement.create({
            inventory: inv._id,
            inventoryName: orig.inventoryName,
            type: "return",
            quantityChange: returnQty, // pozitivno
            quantityBefore,
            quantityAfter,
            unit: orig.unit,
            order: order._id,
            menuItem: orig.menuItem,
            menuItemName: orig.menuItemName,
            outlet: orig.outlet,
            user: user?._id || null,
            userName: user?.name || null,
            reason: `Order ${order.orderId} cancelled`,
            costPerUnit: orig.costPerUnit,
            totalValue: orig.totalValue,
        });

        movements.push(movement);
    }

    return { restocked: movements.length, movements };
};

module.exports = { depleteStockForOrder, restockForCancelledOrder };

