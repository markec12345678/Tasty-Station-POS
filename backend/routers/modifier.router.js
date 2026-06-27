const express = require("express");
const router = express.Router();
const {
    getModifierGroups, getModifierGroup,
    createModifierGroup, updateModifierGroup, deleteModifierGroup,
    addModifier, updateModifier, deleteModifier,
} = require("../controllers/modifier.controller");
const { protectedRoute, isAdmin } = require("../middlewares/auth.middleware");

// Javni (avtenticirani) — za pregled v POS
router.get("/", protectedRoute, getModifierGroups);
router.get("/:id", protectedRoute, getModifierGroup);

// Admin-only
router.post("/", protectedRoute, isAdmin, createModifierGroup);
router.put("/:id", protectedRoute, isAdmin, updateModifierGroup);
router.delete("/:id", protectedRoute, isAdmin, deleteModifierGroup);
router.post("/:id/modifier", protectedRoute, isAdmin, addModifier);
router.put("/:groupId/modifier/:modifierId", protectedRoute, isAdmin, updateModifier);
router.delete("/:groupId/modifier/:modifierId", protectedRoute, isAdmin, deleteModifier);

module.exports = router;
