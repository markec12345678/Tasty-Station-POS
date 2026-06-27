const express = require("express");
const router = express.Router();
const {
    getModifierGroups, getModifierGroup,
    createModifierGroup, updateModifierGroup, deleteModifierGroup,
    addModifier, updateModifier, deleteModifier,
} = require("../controllers/modifier.controller");
const { protectedRoute } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");

// Javni (avtenticirani) — za pregled v POS
router.get("/", protectedRoute, getModifierGroups);
router.get("/:id", protectedRoute, getModifierGroup);

// Admin-only
router.post("/", protectedRoute, requirePermission("modifiers:create"), createModifierGroup);
router.put("/:id", protectedRoute, requirePermission("modifiers:update"), updateModifierGroup);
router.delete("/:id", protectedRoute, requirePermission("modifiers:delete"), deleteModifierGroup);
router.post("/:id/modifier", protectedRoute, requirePermission("modifiers:create"), addModifier);
router.put("/:groupId/modifier/:modifierId", protectedRoute, requirePermission("modifiers:update"), updateModifier);
router.delete("/:groupId/modifier/:modifierId", protectedRoute, requirePermission("modifiers:delete"), deleteModifier);

module.exports = router;
