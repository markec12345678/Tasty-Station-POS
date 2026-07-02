const express = require("express");
const router = express.Router();
const {
    addStockItem,
    getInventory,
    updateStock,
    deleteStockItem,
    getStockReports
} = require("../controllers/inventory.controller");
const { protectedRoute } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");

// Vsi endpointi zahtevajo avtentikacijo (prejšnje stanje: popolnoma javni — varnostna luknja)
router.use(protectedRoute);

router.get("/", requirePermission("inventory:read"), getInventory);
router.post("/", requirePermission("inventory:create"), addStockItem);
router.put("/:id", requirePermission("inventory:update"), updateStock);
router.delete("/:id", requirePermission("inventory:delete"), deleteStockItem);
router.get("/reports", requirePermission("inventory:read"), getStockReports);

module.exports = router;
