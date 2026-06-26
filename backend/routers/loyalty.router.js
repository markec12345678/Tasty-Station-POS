const express = require("express");
const router = express.Router();
const {
    getLoyaltySettings,
    updateLoyaltySettings,
    getRewards,
    createReward,
    updateReward,
    deleteReward,
    getClientLoyalty,
    redeemReward,
    adjustPoints,
} = require("../controllers/loyalty.controller");
const { protectedRoute, isAdmin } = require("../middlewares/auth.middleware");

// Public (authenticated only)
router.get("/settings", protectedRoute, getLoyaltySettings);
router.get("/rewards", protectedRoute, getRewards);
router.get("/client/:clientId", protectedRoute, getClientLoyalty);
router.post("/redeem", protectedRoute, redeemReward);

// Admin-only
router.put("/settings", protectedRoute, isAdmin, updateLoyaltySettings);
router.post("/rewards", protectedRoute, isAdmin, createReward);
router.put("/rewards/:id", protectedRoute, isAdmin, updateReward);
router.delete("/rewards/:id", protectedRoute, isAdmin, deleteReward);
router.post("/adjust", protectedRoute, isAdmin, adjustPoints);

module.exports = router;
