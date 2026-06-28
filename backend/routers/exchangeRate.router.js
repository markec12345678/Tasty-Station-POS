const express = require("express");
const router = express.Router();
const { getRates, refreshRates, convert } = require("../controllers/exchangeRate.controller");
const { protectedRoute } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");

// Javni endpoint — vsi lahko vidijo tečaje
router.get("/", getRates);
router.get("/convert", convert);

// Admin only — ročno osveži tečaje
router.post("/refresh", protectedRoute, requirePermission("currency:update"), refreshRates);

module.exports = router;
