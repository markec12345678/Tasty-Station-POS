const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const { protectedRoute, isAdmin } = require("../middlewares/auth.middleware");
const archiver = require("archiver");
const multer = require("multer");
const AdmZip = require("adm-zip");

const User = require("../models/user.model");
const { Category, MenuItem } = require("../models/menu.model");
const Table = require("../models/table.model");
const Client = require("../models/client.model");
const Inventory = require("../models/inventory.model");
const Tax = require("../models/tax.model");
const Discount = require("../models/discount.model");
const Reward = require("../models/reward.model");
const Order = require("../models/order.model");

// GET /api/backup — stream ZIP z JSON dump-om vseh kolekcij (admin only)
router.get("/", protectedRoute, isAdmin, async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const filename = `tasty-station-backup-${timestamp}.zip`;

        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

        const archive = archiver("zip", { zlib: { level: 9 } });
        archive.on("error", (err) => {
            console.error("Backup archive error:", err);
            res.status(500).json({ success: false, message: err.message });
        });
        archive.pipe(res);

        const [users, categories, menuItems, tables, clients, inventory, taxes, discounts, rewards, orders] = await Promise.all([
            User.find().select("-password").lean(),
            Category.find().lean(),
            MenuItem.find().lean(),
            Table.find().lean(),
            Client.find().lean(),
            Inventory.find().lean(),
            Tax.find().lean(),
            Discount.find().lean(),
            Reward.find().lean(),
            Order.find().lean(),
        ]);

        const dump = {
            meta: {
                version: "1.0",
                exportedAt: new Date().toISOString(),
                exportedBy: req.user?.email || "unknown",
                counts: {
                    users: users.length, categories: categories.length, menuItems: menuItems.length,
                    tables: tables.length, clients: clients.length, inventory: inventory.length,
                    taxes: taxes.length, discounts: discounts.length, rewards: rewards.length, orders: orders.length,
                },
            },
            users, categories, menuItems, tables, clients, inventory, taxes, discounts, rewards, orders,
        };

        archive.append(JSON.stringify(dump, null, 2), { name: "database.json" });
        archive.append(JSON.stringify(dump.meta, null, 2), { name: "manifest.json" });
        archive.finalize();
    } catch (error) {
        console.error("Backup error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// POST /api/backup/restore — admin only
router.post("/restore", protectedRoute, isAdmin, upload.single("backup"), async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No backup file uploaded" });
        }
        const dropExisting = req.body?.dropExisting === "true" || req.body?.dropExisting === true;

        const zip = new AdmZip(req.file.buffer);
        const dbJsonEntry = zip.getEntries().find(e => e.entryName.endsWith("database.json"));
        if (!dbJsonEntry) {
            return res.status(400).json({ success: false, message: "Invalid backup file — database.json not found" });
        }
        const dump = JSON.parse(dbJsonEntry.getData().toString("utf8"));
        if (!dump.meta || !dump.meta.version) {
            return res.status(400).json({ success: false, message: "Invalid backup format — meta.version missing" });
        }

        if (dropExisting) {
            await Promise.all([
                User.deleteMany({}).session(session),
                Category.deleteMany({}).session(session),
                MenuItem.deleteMany({}).session(session),
                Table.deleteMany({}).session(session),
                Client.deleteMany({}).session(session),
                Inventory.deleteMany({}).session(session),
                Tax.deleteMany({}).session(session),
                Discount.deleteMany({}).session(session),
                Reward.deleteMany({}).session(session),
                Order.deleteMany({}).session(session),
            ]);
        }

        const inserted = { users: 0, categories: 0, menuItems: 0, tables: 0, clients: 0, inventory: 0, taxes: 0, discounts: 0, rewards: 0, orders: 0 };
        if (dump.users?.length) { const r = await User.insertMany(dump.users, { session, ordered: false }); inserted.users = r.length; }
        if (dump.categories?.length) { const r = await Category.insertMany(dump.categories, { session, ordered: false }); inserted.categories = r.length; }
        if (dump.menuItems?.length) { const r = await MenuItem.insertMany(dump.menuItems, { session, ordered: false }); inserted.menuItems = r.length; }
        if (dump.tables?.length) { const r = await Table.insertMany(dump.tables, { session, ordered: false }); inserted.tables = r.length; }
        if (dump.clients?.length) { const r = await Client.insertMany(dump.clients, { session, ordered: false }); inserted.clients = r.length; }
        if (dump.inventory?.length) { const r = await Inventory.insertMany(dump.inventory, { session, ordered: false }); inserted.inventory = r.length; }
        if (dump.taxes?.length) { const r = await Tax.insertMany(dump.taxes, { session, ordered: false }); inserted.taxes = r.length; }
        if (dump.discounts?.length) { const r = await Discount.insertMany(dump.discounts, { session, ordered: false }); inserted.discounts = r.length; }
        if (dump.rewards?.length) { const r = await Reward.insertMany(dump.rewards, { session, ordered: false }); inserted.rewards = r.length; }
        if (dump.orders?.length) { const r = await Order.insertMany(dump.orders, { session, ordered: false }); inserted.orders = r.length; }

        await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            message: "Backup restored successfully",
            inserted,
            source: dump.meta,
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error("Restore error:", error);
        res.status(500).json({
            success: false,
            message: error.message,
            note: error.code === 11000 ? "Duplicate key error — try again with dropExisting=true" : undefined,
        });
    }
});

// GET /api/backup/stats — admin only
router.get("/stats", protectedRoute, isAdmin, async (req, res) => {
    try {
        const counts = {
            users: await User.countDocuments(),
            categories: await Category.countDocuments(),
            menuItems: await MenuItem.countDocuments(),
            tables: await Table.countDocuments(),
            clients: await Client.countDocuments(),
            inventory: await Inventory.countDocuments(),
            taxes: await Tax.countDocuments(),
            discounts: await Discount.countDocuments(),
            rewards: await Reward.countDocuments(),
            orders: await Order.countDocuments(),
        };
        counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
        res.status(200).json({ success: true, counts });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
