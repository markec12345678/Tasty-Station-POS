const express = require("express");
const router = express.Router();
const { getForecast, getLowStock } = require("../controllers/inventoryForecast.controller");
const { protectedRoute } = require("../middlewares/auth.middleware");

router.use(protectedRoute);

// AI napoved porabe (z fallback na statistiko če GEMINI_API_KEY manjka)
router.get("/forecast", getForecast);

// Hitri seznam item-ov, ki potrebujejo reorder
router.get("/forecast/low-stock", getLowStock);

module.exports = router;
