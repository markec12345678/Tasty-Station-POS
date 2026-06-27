const express = require("express");
const router = express.Router();
const { createTable, getTables, updateTable, deleteTable, reserveTable, cancelReservation } = require("../controllers/table.controller");
const { protectedRoute } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");

router.use(protectedRoute);

router.get("/", requirePermission("tables:read"), getTables);
router.post("/", requirePermission("tables:create"), createTable);
router.put("/:id", requirePermission("tables:update"), updateTable);
router.delete("/:id", requirePermission("tables:delete"), deleteTable);
router.post("/:id/reserve", requirePermission("tables:reserve"), reserveTable);
router.post("/:id/cancel-reservation", requirePermission("tables:reserve"), cancelReservation);

module.exports = router;
