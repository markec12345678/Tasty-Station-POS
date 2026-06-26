const express = require("express");
const router = express.Router();
const {
    getOutlets, getOutlet, createOutlet, updateOutlet, deleteOutlet, setPrimary
} = require("../controllers/outlet.controller");
const { protectedRoute, isAdmin } = require("../middlewares/auth.middleware");

// Vsi endpointi zahtevajo avtentikacijo
router.use(protectedRoute);

router.get("/", getOutlets);
router.get("/:id", getOutlet);

// Admin-only endpointi
router.post("/", isAdmin, createOutlet);
router.put("/:id", isAdmin, updateOutlet);
router.delete("/:id", isAdmin, deleteOutlet);
router.post("/:id/set-primary", isAdmin, setPrimary);

module.exports = router;
