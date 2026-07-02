const Client = require("../models/client.model");
const Order = require("../models/order.model");
const Reward = require("../models/reward.model");
const LoyaltySettings = require("../models/loyaltySettings.model");
const ApiError = require("../utils/ApiError");
const { logAction } = require("../middlewares/auditLog.middleware");

// === LoyaltySettings ===
const getLoyaltySettings = async (req, res, next) => {
    try {
        const settings = await LoyaltySettings.getSettings();
        res.status(200).json({ success: true, settings });
    } catch (error) { next(error); }
};

const updateLoyaltySettings = async (req, res, next) => {
    try {
        const settings = await LoyaltySettings.getSettings();
        const before = settings.toObject();
        Object.assign(settings, req.body);
        await settings.save();

        // Audit log — loyalty_settings_update (non-blocking)
        logAction(req, {
            action: "loyalty_settings_update",
            entity: "loyalty",
            description: `Loyalty settings updated by ${req.user?.email}`,
            changes: { before, after: settings.toObject() },
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(200).json({ success: true, message: "Settings updated", settings });
    } catch (error) { next(error); }
};

// === Rewards CRUD ===
const getRewards = async (req, res, next) => {
    try {
        const { active } = req.query;
        const filter = active === "true" ? { isActive: true } : {};
        const rewards = await Reward.find(filter).sort({ pointsCost: 1 });
        res.status(200).json({ success: true, rewards });
    } catch (error) { next(error); }
};

const createReward = async (req, res, next) => {
    try {
        const reward = await Reward.create(req.body);
        res.status(201).json({ success: true, message: "Reward created", reward });
    } catch (error) { next(error); }
};

const updateReward = async (req, res, next) => {
    try {
        const { id } = req.params;
        const reward = await Reward.findByIdAndUpdate(id, req.body, { new: true });
        if (!reward) return res.status(404).json({ success: false, message: "Reward not found" });
        res.status(200).json({ success: true, message: "Reward updated", reward });
    } catch (error) { next(error); }
};

const deleteReward = async (req, res, next) => {
    try {
        const { id } = req.params;
        const reward = await Reward.findByIdAndDelete(id);
        if (!reward) return res.status(404).json({ success: false, message: "Reward not found" });
        res.status(200).json({ success: true, message: "Reward deleted" });
    } catch (error) { next(error); }
};

// === Client loyalty ===
const getClientLoyalty = async (req, res, next) => {
    try {
        const { clientId } = req.params;
        const client = await Client.findById(clientId)
            .select("name phone loyaltyPoints tier totalSpent loyaltyHistory");
        if (!client) return res.status(404).json({ success: false, message: "Client not found" });

        const settings = await LoyaltySettings.getSettings();
        const rewards = await Reward.find({ isActive: true }).sort({ pointsCost: 1 });

        const tierOrder = ["Bronze", "Silver", "Gold", "Platinum"];
        const currentTierIdx = tierOrder.indexOf(client.tier);
        const nextTier = currentTierIdx < tierOrder.length - 1 ? tierOrder[currentTierIdx + 1] : null;
        const nextTierThreshold = nextTier ? settings.tierThresholds[nextTier.toLowerCase()] : null;
        const progressToNext = nextTierThreshold
            ? Math.min(100, (client.totalSpent / nextTierThreshold) * 100)
            : 100;
        const availableRewards = rewards.filter(r => r.pointsCost <= client.loyaltyPoints);

        res.status(200).json({
            success: true,
            loyalty: {
                client: {
                    _id: client._id,
                    name: client.name,
                    phone: client.phone,
                    loyaltyPoints: client.loyaltyPoints,
                    tier: client.tier,
                    totalSpent: client.totalSpent,
                },
                history: client.loyaltyHistory.slice(-20).reverse(),
                tierProgress: {
                    current: client.tier,
                    next: nextTier,
                    currentThreshold: settings.tierThresholds[client.tier.toLowerCase()],
                    nextTierThreshold,
                    progress: progressToNext,
                    amountToNext: nextTierThreshold ? Math.max(0, nextTierThreshold - client.totalSpent) : 0,
                },
                availableRewards,
                allRewards: rewards,
            }
        });
    } catch (error) { next(error); }
};

const redeemReward = async (req, res, next) => {
    try {
        const { clientId, rewardId, orderId } = req.body;
        const client = await Client.findById(clientId);
        if (!client) throw new ApiError(404, "Client not found");

        const reward = await Reward.findById(rewardId);
        if (!reward || !reward.isActive) throw new ApiError(404, "Reward not found or inactive");

        if (client.loyaltyPoints < reward.pointsCost) {
            throw new ApiError(400, `Insufficient points (have ${client.loyaltyPoints}, need ${reward.pointsCost})`);
        }

        client.loyaltyPoints -= reward.pointsCost;
        client.loyaltyHistory.push({
            type: "redeemed",
            points: -reward.pointsCost,
            balance: client.loyaltyPoints,
            reason: `Reward: ${reward.name}`,
            orderId: orderId || null,
            timestamp: new Date()
        });
        await client.save();

        // Audit log — loyalty_redeem (non-blocking)
        logAction(req, {
            action: "loyalty_redeem",
            entity: "loyalty",
            entityId: client._id,
            description: `Client ${client.name} redeemed ${reward.name} for ${reward.pointsCost} points (new balance: ${client.loyaltyPoints})`,
            changes: { before: { points: client.loyaltyPoints + reward.pointsCost }, after: { points: client.loyaltyPoints } },
        }).catch(e => console.error("Audit log error:", e.message));

        let discount = 0;
        if (reward.type === "fixed_discount") {
            discount = reward.value;
        } else if (reward.type === "percentage_discount") {
            if (orderId) {
                const order = await Order.findById(orderId);
                if (order) discount = (order.totalAmount * reward.value) / 100;
            }
        }

        res.status(200).json({
            success: true,
            message: `Reward redeemed: ${reward.name}`,
            reward,
            discount,
            remainingPoints: client.loyaltyPoints,
        });
    } catch (error) { next(error); }
};

const adjustPoints = async (req, res, next) => {
    try {
        const { clientId, points, reason } = req.body;
        if (!points || points === 0) throw new ApiError(400, "Points must be non-zero");

        const client = await Client.findById(clientId);
        if (!client) throw new ApiError(404, "Client not found");

        const newBalance = Math.max(0, client.loyaltyPoints + points);
        const actualChange = newBalance - client.loyaltyPoints;

        client.loyaltyPoints = newBalance;
        client.loyaltyHistory.push({
            type: "adjusted",
            points: actualChange,
            balance: newBalance,
            reason: reason || `Manual adjustment by ${req.user?.email || 'admin'}`,
            timestamp: new Date()
        });
        await client.save();

        // Audit log — loyalty_adjust (non-blocking)
        logAction(req, {
            action: "loyalty_adjust",
            entity: "loyalty",
            entityId: client._id,
            description: `Loyalty points adjusted by ${actualChange > 0 ? '+' : ''}${actualChange} for ${client.name} (new balance: ${newBalance}) by ${req.user?.email}`,
            changes: { before: { points: client.loyaltyPoints - actualChange }, after: { points: newBalance, reason: reason || "Manual adjustment" } },
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(200).json({
            success: true,
            message: `Points ${actualChange > 0 ? 'added' : 'deducted'}`,
            newBalance: client.loyaltyPoints,
            change: actualChange,
        });
    } catch (error) { next(error); }
};

// Internal helper — kliče se iz order.controller.js ko je order Completed
const awardPointsForOrder = async (order, _session = null) => {
    try {
        if (!order.client) return null;
        const settings = await LoyaltySettings.getSettings();
        if (!settings.enabled) return null;

        const client = await Client.findById(order.client);
        if (!client) return null;

        const multiplier = settings.tierMultipliers[client.tier.toLowerCase()] || 1.0;
        const earnedPoints = Math.floor((order.totalAmount / settings.pointsPerRupee) * multiplier);
        if (earnedPoints <= 0) return null;

        client.loyaltyPoints += earnedPoints;
        client.loyaltyHistory.push({
            type: "earned",
            points: earnedPoints,
            balance: client.loyaltyPoints,
            reason: `Order ${order.orderId}`,
            orderId: order._id,
            timestamp: new Date()
        });

        if (client.updateTier) client.updateTier();
        await client.save();

        return { earnedPoints, newBalance: client.loyaltyPoints, tier: client.tier };
    } catch (error) {
        console.error("Award points error:", error);
        return null;
    }
};

module.exports = {
    getLoyaltySettings, updateLoyaltySettings,
    getRewards, createReward, updateReward, deleteReward,
    getClientLoyalty, redeemReward, adjustPoints,
    awardPointsForOrder,
};
