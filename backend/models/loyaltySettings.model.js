const mongoose = require("mongoose");

/**
 * LoyaltySettings — globalne nastavitve loyalty programa.
 * Single document (singleton) — pridobi se vedno prvi dokument.
 */
const loyaltySettingsSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: true },
    pointsPerRupee: { type: Number, default: 100, min: 1 },
    pointValue: { type: Number, default: 1, min: 0 },
    tierThresholds: {
        bronze: { type: Number, default: 0 },
        silver: { type: Number, default: 5000 },
        gold: { type: Number, default: 15000 },
        platinum: { type: Number, default: 50000 }
    },
    tierMultipliers: {
        bronze: { type: Number, default: 1.0 },
        silver: { type: Number, default: 1.2 },
        gold: { type: Number, default: 1.5 },
        platinum: { type: Number, default: 2.0 }
    },
    expirationDays: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

loyaltySettingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

const LoyaltySettings = mongoose.models.LoyaltySettings || mongoose.model("LoyaltySettings", loyaltySettingsSchema);
module.exports = LoyaltySettings;
