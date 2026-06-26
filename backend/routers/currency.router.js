const express = require("express");
const router = express.Router();
const {
    getCurrencySettings,
    updateCurrencySettings,
    applyPreset,
    getPresets,
} = require("../controllers/currency.controller");
const { protectedRoute, isAdmin } = require("../middlewares/auth.middleware");

// Javni endpointi (uporablja se pri load-u aplikacije)
router.get("/", getCurrencySettings);
router.get("/presets", getPresets);

// Admin-only endpointi
router.put("/", protectedRoute, isAdmin, updateCurrencySettings);
router.post("/preset/:code", protectedRoute, isAdmin, applyPreset);

module.exports = router;
