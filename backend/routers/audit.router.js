const express = require("express");
const router = express.Router();
const AuditLog = require("../models/auditLog.model");
const { protectedRoute, isAdmin } = require("../middlewares/auth.middleware");

// Vsi endpointi so zaščiteni z Admin
router.use(protectedRoute, isAdmin);

/**
 * GET /api/audit
 * Query params:
 *   - page (default 1)
 *   - limit (default 50, max 200)
 *   - action (filter by action)
 *   - entity (filter by entity)
 *   - userId (filter by user)
 *   - status (filter by status: success/failed/warning)
 *   - startDate (ISO date)
 *   - endDate (ISO date)
 *   - search (search in description)
 */
router.get("/", async (req, res) => {
    try {
        const {
            page = 1, limit = 50,
            action, entity, userId, status,
            startDate, endDate, search,
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        // Build filter
        const filter = {};
        if (action) filter.action = action;
        if (entity) filter.entity = entity;
        if (userId) filter.user = userId;
        if (status) filter.status = status;

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        if (search) {
            filter.$or = [
                { description: { $regex: search, $options: "i" } },
                { userEmail: { $regex: search, $options: "i" } },
            ];
        }

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .populate("user", "name email role avatar")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            AuditLog.countDocuments(filter),
        ]);

        res.status(200).json({
            success: true,
            logs,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
                hasNext: pageNum * limitNum < total,
                hasPrev: pageNum > 1,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/audit/stats
 * Vri agregirane statistike za dashboard
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

        const matchStage = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

        const [actionCounts, statusCounts, topUsers, recent] = await Promise.all([
            // Akcije po tipu
            AuditLog.aggregate([
                { $match: matchStage },
                { $group: { _id: "$action", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 },
            ]),
            // Status distribucija
            AuditLog.aggregate([
                { $match: matchStage },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),
            // Top uporabniki
            AuditLog.aggregate([
                { $match: { ...matchStage, user: { $ne: null } } },
                { $group: { _id: "$user", count: { $sum: 1 }, lastAction: { $max: "$createdAt" } } },
                { $sort: { count: -1 } },
                { $limit: 10 },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "user",
                    }
                },
                { $unwind: "$user" },
                { $project: { "user.password": 0 } },
            ]),
            // Skupno število
            AuditLog.countDocuments(matchStage),
        ]);

        res.status(200).json({
            success: true,
            stats: {
                total: recent,
                byAction: actionCounts,
                byStatus: statusCounts,
                topUsers,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * DELETE /api/audit
 * Izbriše starejše loge od podanega datuma (admin only)
 * Query: olderThan (ISO date)
 */
router.delete("/", async (req, res) => {
    try {
        const { olderThan } = req.query;
        if (!olderThan) {
            return res.status(400).json({
                success: false,
                message: "olderThan query parameter is required (ISO date)"
            });
        }
        const cutoff = new Date(olderThan);
        if (isNaN(cutoff.getTime())) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format for olderThan"
            });
        }
        const result = await AuditLog.deleteMany({ createdAt: { $lt: cutoff } });
        res.status(200).json({
            success: true,
            message: `Deleted ${result.deletedCount} audit log entries older than ${cutoff.toISOString()}`,
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
