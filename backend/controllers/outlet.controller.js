const Outlet = require("../models/outlet.model");
const Table = require("../models/table.model");
const Order = require("../models/order.model");
const User = require("../models/user.model");

// GET /api/outlets — vrne vse outlete (admin only)
const getOutlets = async (req, res, next) => {
    try {
        const outlets = await Outlet.getActiveWithStats();

        // Za vsak outlet dodaj realne stat-e iz DB
        const outletsWithStats = await Promise.all(outlets.map(async (outlet) => {
            const [tableCount, staffCount, orderStats] = await Promise.all([
                Table.countDocuments({ outletId: outlet._id }),
                User.countDocuments({ outletId: outlet._id, isActive: true }),
                Order.aggregate([
                    { $match: { outletId: outlet._id, status: "Completed" } },
                    { $group: { _id: null, revenue: { $sum: "$totalAmount" }, count: { $sum: 1 } } }
                ]),
            ]);

            return {
                ...outlet,
                stats: {
                    totalTables: tableCount,
                    totalStaff: staffCount,
                    totalRevenue: orderStats[0]?.revenue || 0,
                    totalOrders: orderStats[0]?.count || 0,
                },
            };
        }));

        res.status(200).json({ success: true, outlets: outletsWithStats });
    } catch (error) { next(error); }
};

// GET /api/outlets/:id
const getOutlet = async (req, res, next) => {
    try {
        const outlet = await Outlet.findById(req.params.id)
            .populate("manager", "name email phone avatar");
        if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found" });
        res.status(200).json({ success: true, outlet });
    } catch (error) { next(error); }
};

// POST /api/outlets — admin only
const createOutlet = async (req, res, next) => {
    try {
        const outlet = await Outlet.create(req.body);
        res.status(201).json({ success: true, message: "Outlet created", outlet });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Outlet code already exists" });
        }
        next(error);
    }
};

// PUT /api/outlets/:id — admin only
const updateOutlet = async (req, res, next) => {
    try {
        const outlet = await Outlet.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found" });
        res.status(200).json({ success: true, message: "Outlet updated", outlet });
    } catch (error) { next(error); }
};

// DELETE /api/outlets/:id — admin only (soft delete — set isActive = false)
const deleteOutlet = async (req, res, next) => {
    try {
        const outlet = await Outlet.findByIdAndUpdate(
            req.params.id,
            { isActive: false, isPrimary: false },
            { new: true }
        );
        if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found" });
        res.status(200).json({ success: true, message: "Outlet deactivated", outlet });
    } catch (error) { next(error); }
};

// POST /api/outlets/:id/set-primary — admin only, nastavi primarni outlet
const setPrimary = async (req, res, next) => {
    try {
        // Najprej odstrani primary od vseh
        await Outlet.updateMany({}, { isPrimary: false });
        // Nato nastavi na izbranega
        const outlet = await Outlet.findByIdAndUpdate(req.params.id, { isPrimary: true }, { new: true });
        if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found" });
        res.status(200).json({ success: true, message: "Primary outlet set", outlet });
    } catch (error) { next(error); }
};

module.exports = {
    getOutlets,
    getOutlet,
    createOutlet,
    updateOutlet,
    deleteOutlet,
    setPrimary,
};
