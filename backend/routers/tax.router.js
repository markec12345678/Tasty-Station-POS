const express = require("express");
const router = express.Router();
const { createTax, getTaxes, getActiveTax, updateTax, deleteTax } = require("../controllers/tax.controller");
const { protectedRoute, isAdmin } = require("../middlewares/auth.middleware");

// Javni endpoint — aktivni tax (uporablja se pri checkout-u, brez avtentikacije)
router.get("/active", getActiveTax);

// Vsi ostali endpointi so zaščiteni z Auth + Admin
router.use(protectedRoute, isAdmin);

router.post("/", createTax);
router.get("/", getTaxes);
router.put("/:id", updateTax);
router.delete("/:id", deleteTax);

module.exports = router;
