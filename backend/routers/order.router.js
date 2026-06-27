const express = require("express");
const router = express.Router();
const {
    createOrder, getAllOrders, getOrderById, getOrderStats,
    updateOrderStatus, getKitchenOrders, sendCourseToKitchen, addPayment
} = require("../controllers/order.controller");
const { protectedRoute } = require("../middlewares/auth.middleware");
const { createOrderValidator, updateStatusValidator } = require("../middlewares/validators/order.validator");
const validate = require("../middlewares/validators/validate.middleware");

router.use(protectedRoute);

router.post("/", createOrderValidator, validate, createOrder);
router.get("/", getAllOrders);
router.get("/kitchen", getKitchenOrders);
router.get("/stats", getOrderStats);
router.post("/:id/payment", addPayment);
router.post("/:id/send-course", sendCourseToKitchen);
router.patch("/:id/status", updateStatusValidator, validate, updateOrderStatus);
router.get("/:id", getOrderById);

module.exports = router;
