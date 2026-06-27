const express = require("express");
const router = express.Router();
const {
    getOutlets, getOutlet, createOutlet, updateOutlet, deleteOutlet, setPrimary
} = require("../controllers/outlet.controller");
const { protectedRoute } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");

// Vsi endpointi zahtevajo avtentikacijo
router.use(protectedRoute);

router.get("/", getOutlets);
router.get("/:id", getOutlet);

// Admin-only endpointi
router.post("/", requirePermission("outlets:create"), createOutlet);
router.put("/:id", requirePermission("outlets:update"), updateOutlet);
router.delete("/:id", requirePermission("outlets:delete"), deleteOutlet);
router.post("/:id/set-primary", requirePermission("outlets:update"), setPrimary);

module.exports = router;
