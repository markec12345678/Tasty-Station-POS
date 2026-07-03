const express = require("express");
const router = express.Router();
const Recipe = require("../models/recipe.model");
const Inventory = require("../models/inventory.model");
const { MenuItem } = require("../models/menu.model");
const { protectedRoute } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const ApiError = require("../utils/ApiError");

// Vse recipe route-e zahtevajo avtentikacijo
router.use(protectedRoute);

/**
 * GET /api/recipes
 * Vrne vse recepte z populate-animi menuItem in inventory sestavinami.
 * Query: ?menuItem=<id> — filtrira po specifičnem menu item-u
 */
router.get("/", requirePermission("menu:read"), async (req, res, next) => {
    try {
        const filter = { isActive: true };
        if (req.query.menuItem) filter.menuItem = req.query.menuItem;

        const recipes = await Recipe.find(filter)
            .populate("menuItem", "name price category image")
            .populate("ingredients.inventory", "name unit costPerUnit category quantity")
            .sort({ updatedAt: -1 });

        res.status(200).json({ success: true, count: recipes.length, recipes });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/recipes/:menuItemId
 * Vrne recept za specifičen menu item (z ingredients + computedCost).
 */
router.get("/:menuItemId", requirePermission("menu:read"), async (req, res, next) => {
    try {
        const recipe = await Recipe.findOne({
            menuItem: req.params.menuItemId,
            isActive: true,
        })
            .populate("menuItem", "name price category image costPrice")
            .populate("ingredients.inventory", "name unit costPerUnit category quantity reorderLevel supplier");

        if (!recipe) {
            return res.status(404).json({
                success: false,
                message: "No recipe found for this menu item",
            });
        }

        res.status(200).json({ success: true, recipe });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/recipes
 * Ustvari ali posodobi (upsert) recept za menu item.
 * En menu item ima lahko samo en aktivni recept (unique index na menuItem).
 *
 * Body: {
 *   menuItem: <ObjectId>,
 *   ingredients: [{ inventory, quantity, unit?, optional?, note? }],
 *   instructions?: string,
 *   prepTime?: number
 * }
 */
router.post("/", requirePermission("menu:create"), async (req, res, next) => {
    try {
        const { menuItem, ingredients, instructions, prepTime } = req.body;

        if (!menuItem) throw new ApiError(400, "menuItem is required");
        if (!Array.isArray(ingredients) || ingredients.length === 0) {
            throw new ApiError(400, "At least one ingredient is required");
        }

        // Validiraj da menu item obstaja
        const mi = await MenuItem.findById(menuItem);
        if (!mi) throw new ApiError(404, "Menu item not found");

        // Validiraj da vse inventory sestavine obstajajo
        for (const ing of ingredients) {
            if (!ing.inventory) throw new ApiError(400, "Each ingredient needs an inventory ID");
            const inv = await Inventory.findById(ing.inventory);
            if (!inv) throw new ApiError(404, `Inventory item not found: ${ing.inventory}`);
            if (!ing.quantity || ing.quantity <= 0) {
                throw new ApiError(400, "Ingredient quantity must be > 0");
            }
        }

        // Upsert — če recept za ta menu item že obstaja, ga posodobi
        const recipe = await Recipe.findOneAndUpdate(
            { menuItem, isActive: true },
            {
                menuItem,
                ingredients: ingredients.map(ing => ({
                    inventory: ing.inventory,
                    quantity: ing.quantity,
                    unit: ing.unit || null,
                    optional: ing.optional || false,
                    note: ing.note || "",
                })),
                instructions: instructions || "",
                prepTime: prepTime || 0,
                isActive: true,
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        ).populate("menuItem", "name price category")
         .populate("ingredients.inventory", "name unit costPerUnit category");

        // Preračunaj computedCost
        await recipe.recomputeCost();
        await recipe.save();

        res.status(201).json({
            success: true,
            message: "Recipe saved successfully",
            recipe,
        });
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/recipes/:id
 * Soft-delete recepta (isActive = false).
 */
router.delete("/:id", requirePermission("menu:delete"), async (req, res, next) => {
    try {
        const recipe = await Recipe.findByIdAndUpdate(
            req.params.id,
            { isActive: false },
            { new: true }
        );
        if (!recipe) {
            return res.status(404).json({ success: false, message: "Recipe not found" });
        }
        res.status(200).json({
            success: true,
            message: "Recipe deactivated (soft delete)",
        });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /api/recipes/:menuItemId/cost
 * Vrne trenutno ceno recepta (recipe costing — koliko stane izdelava jedi).
 * Uporabno za admin dashboard za analizo marže (price - computedCost = profit).
 */
router.get("/:menuItemId/cost", requirePermission("menu:read"), async (req, res, next) => {
    try {
        const recipe = await Recipe.findOne({
            menuItem: req.params.menuItemId,
            isActive: true,
        }).populate("ingredients.inventory", "name unit costPerUnit");

        if (!recipe) {
            return res.status(404).json({
                success: false,
                message: "No recipe found for this menu item",
            });
        }

        // Preračunaj ceno na podlagi trenutnih cen inventarja
        await recipe.recomputeCost();

        const mi = await MenuItem.findById(req.params.menuItemId).select("name price costPrice");

        res.status(200).json({
            success: true,
            costing: {
                menuItem: mi,
                computedCost: recipe.computedCost,
                salePrice: mi?.price || 0,
                grossProfit: Math.round(((mi?.price || 0) - recipe.computedCost) * 100) / 100,
                marginPercent: mi?.price > 0
                    ? Math.round((((mi?.price || 0) - recipe.computedCost) / mi.price * 100) * 100) / 100
                    : 0,
                ingredients: recipe.ingredients.map(ing => ({
                    inventory: ing.inventory?._id,
                    name: ing.inventory?.name,
                    quantity: ing.quantity,
                    unit: ing.unit || ing.inventory?.unit,
                    costPerUnit: ing.inventory?.costPerUnit,
                    lineCost: Math.round((ing.quantity * (ing.inventory?.costPerUnit || 0)) * 100) / 100,
                })),
            },
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
