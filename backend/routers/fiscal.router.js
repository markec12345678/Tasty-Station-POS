const express = require("express");
const router = express.Router();
const FiscalInvoice = require("../models/fiscalInvoice.model");
const { protectedRoute, isAdmin } = require("../middlewares/auth.middleware");
const { confirmInvoice } = require("../utils/furs");

// Vsi endpointi zahtevajo avtentikacijo
router.use(protectedRoute);

/**
 * GET /api/fiscal
 * Query params:
 *   - page (default 1)
 *   - limit (default 50, max 200)
 *   - status (pending/confirmed/failed/cancelled)
 *   - outletId
 *   - startDate, endDate
 *   - search (po invoiceNumber, zoi, eor)
 */
router.get("/", async (req, res) => {
    try {
        const {
            page = 1, limit = 50,
            status, outletId, startDate, endDate, search,
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        const filter = {};
        if (status) filter.status = status;
        if (outletId) filter.outlet = outletId;
        if (startDate || endDate) {
            filter.issueDateTime = {};
            if (startDate) filter.issueDateTime.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.issueDateTime.$lte = end;
            }
        }
        if (search) {
            filter.$or = [
                { invoiceNumber: { $regex: search, $options: "i" } },
                { zoi: { $regex: search, $options: "i" } },
                { eor: { $regex: search, $options: "i" } },
                { customerName: { $regex: search, $options: "i" } },
            ];
        }

        const [invoices, total] = await Promise.all([
            FiscalInvoice.find(filter)
                .populate("order", "orderId totalAmount status")
                .populate("outlet", "name code")
                .populate("issuedBy", "name email")
                .sort({ issueDateTime: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            FiscalInvoice.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            invoices,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/fiscal/stats — statistike za dashboard
 */
router.get("/stats", async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const dateFilter = {};
        if (startDate) dateFilter.$gte = new Date(startDate);
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.$lte = end;
        }
        const matchStage = Object.keys(dateFilter).length > 0 ? { issueDateTime: dateFilter } : {};

        const [statusCounts, totalRevenue, recent] = await Promise.all([
            FiscalInvoice.aggregate([
                { $match: matchStage },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
            FiscalInvoice.aggregate([
                { $match: { ...matchStage, status: "confirmed" } },
                { $group: { _id: null, total: { $sum: "$totals.total" } } },
            ]),
            FiscalInvoice.countDocuments(matchStage),
        ]);

        res.status(200).json({
            success: true,
            stats: {
                total: recent,
                totalRevenue: totalRevenue[0]?.total || 0,
                byStatus: statusCounts,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/fiscal/:id — posamezni račun
 */
router.get("/:id", async (req, res) => {
    try {
        const invoice = await FiscalInvoice.findById(req.params.id)
            .populate("order")
            .populate("outlet")
            .populate("customer")
            .populate("issuedBy", "name email");
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
        res.status(200).json({ success: true, invoice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * POST /api/fiscal/:id/retry — ponovno pošlji failed račun FURS
 */
router.post("/:id/retry", isAdmin, async (req, res) => {
    try {
        const invoice = await FiscalInvoice.findById(req.params.id).populate("order").populate("outlet");
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
        if (invoice.status === "confirmed") {
            return res.status(400).json({ success: false, message: "Invoice already confirmed" });
        }

        // Retry — ponovno potrdi
        const result = await confirmInvoice(invoice.order, invoice.outlet, invoice.payment.method, req.user);

        if (result.success) {
            invoice.eor = result.eor;
            invoice.status = "confirmed";
            invoice.attempts += 1;
            invoice.error = undefined;
            await invoice.save();
            res.status(200).json({ success: true, message: "Invoice confirmed", invoice });
        } else {
            invoice.attempts += 1;
            invoice.error = { message: result.error, timestamp: new Date() };
            await invoice.save();
            res.status(400).json({ success: false, message: result.error });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
