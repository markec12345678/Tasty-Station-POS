const mongoose = require("mongoose");

/**
 * ExchangeRate — shranjuje trenutne tečaje valut.
 * Single document (singleton) — vedno posodobljen z najnovejšimi tečaji.
 *
 * vir tečajev: exchangerate-api.com (free tier: 1500 req/month)
 * ali ECB (European Central Bank) — brezplačno, brez registracije.
 */
const exchangeRateSchema = new mongoose.Schema({
    base: {
        type: String,
        default: "EUR",
        uppercase: true,
    },
    rates: {
        type: Map,
        of: Number,
        default: {},
        // npr. { "USD": 1.08, "GBP": 0.85, "PKR": 301.5, "CHF": 0.95, ... }
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
    source: {
        type: String,
        default: "ECB",
    },
}, { timestamps: true });

exchangeRateSchema.statics.getRates = async function() {
    let doc = await this.findOne();
    if (!doc) {
        doc = await this.create({ base: "EUR", rates: {} });
    }
    return doc;
};

exchangeRateSchema.statics.updateRates = async function(rates, source = "ECB") {
    let doc = await this.findOne();
    if (!doc) {
        doc = new this({ base: "EUR", rates, source, lastUpdated: new Date() });
    } else {
        doc.rates = rates;
        doc.source = source;
        doc.lastUpdated = new Date();
    }
    await doc.save();
    return doc;
};

const ExchangeRate = mongoose.models.ExchangeRate || mongoose.model("ExchangeRate", exchangeRateSchema);
module.exports = ExchangeRate;
