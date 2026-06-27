const express = require("express");
const router = express.Router();
const {
    createCategory, getAllCategories, getCategoryById, updateCategory, deleteCategory,
    createMenuItem, getAllMenuItems, getMenuItemById, updateMenuItem, deleteMenuItem
} = require("../controllers/menu.controller");
const { protectedRoute } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { validateCategory, validateMenuItem } = require("../middlewares/validators/menu.validator");
const { cacheMiddleware } = require("../middlewares/cache.middleware");

// --- Category Routes ---
router.post("/category", protectedRoute, requirePermission("menu:create"), validateCategory, createCategory);
router.get("/category", cacheMiddleware(3600), getAllCategories);
router.get("/category/:id", getCategoryById);
router.put("/category/:id", protectedRoute, requirePermission("menu:update"), updateCategory);
router.delete("/category/:id", protectedRoute, requirePermission("menu:delete"), deleteCategory);

// --- Menu Item Routes ---
router.post("/item", protectedRoute, requirePermission("menu:create"), validateMenuItem, createMenuItem);
router.get("/item", cacheMiddleware(3600), getAllMenuItems);
router.get("/item/:id", getMenuItemById);
router.put("/item/:id", protectedRoute, requirePermission("menu:update"), updateMenuItem);
router.delete("/item/:id", protectedRoute, requirePermission("menu:delete"), deleteMenuItem);

module.exports = router;
