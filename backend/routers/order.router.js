const express = require("express");
const router = express.Router();
const {
    createOrder, getAllOrders, getOrderById, getOrderStats,
    updateOrderStatus, getKitchenOrders, sendCourseToKitchen, addPayment
} = require("../controllers/order.controller");
const { protectedRoute } = require("../middlewares/auth.middleware");
const { requirePermission } = require("../middlewares/rbac.middleware");
const { createOrderValidator, updateStatusValidator } = require("../middlewares/validators/order.validator");
const validate = require("../middlewares/validators/validate.middleware");

router.use(protectedRoute);

// Read — all authenticated staff can view orders
router.get("/", requirePermission("orders:read"), getAllOrders);
router.get("/kitchen", requirePermission("kitchen:read"), getKitchenOrders);
router.get("/stats", requirePermission("dashboard:read"), getOrderStats);
router.get("/:id", requirePermission("orders:read"), getOrderById);

// Create — cashier, waiter, manager, admin
router.post("/", requirePermission("orders:create"), createOrderValidator, validate, createOrder);

// Update — status changes, course routing
router.patch("/:id/status", requirePermission("orders:update"), updateStatusValidator, validate, updateOrderStatus);
router.post("/:id/send-course", requirePermission("orders:send-course"), sendCourseToKitchen);

// Payment — cashier, manager, admin only (NOT waiter)
router.post("/:id/payment", requirePermission("orders:payment"), addPayment);

module.exports = router;
