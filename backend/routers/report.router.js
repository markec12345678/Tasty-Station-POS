const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");
const { protectedRoute } = require("../middlewares/auth.middleware");

// Vsi report endpointi so zaščiteni (vsaj login)
router.use(protectedRoute);

router.get("/sales", reportController.getSalesReports);
router.get("/cashier-collections", reportController.getCashierCollections);
router.get("/top-selling", reportController.getTopSellingItems);
router.get("/profit-loss", reportController.getProfitLoss);
router.get("/dashboard", reportController.getDashboard);
router.get("/category-performance", reportController.getCategoryPerformance);

module.exports = router;
