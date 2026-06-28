const ExchangeRate = require("../models/exchangeRate.model");
const axios = require("axios");

// ECB free API — no API key required
// Alternative: https://api.exchangerate.host/latest?base=EUR
const ECB_URL = "https://api.frankfurter.app/latest?from=EUR";

// GET /api/exchange-rates
const getRates = async (req, res, next) => {
    try {
        const doc = await ExchangeRate.getRates();
        const ageMinutes = (Date.now() - new Date(doc.lastUpdated).getTime()) / 60000;

        res.status(200).json({
            success: true,
            base: doc.base,
            rates: doc.rates,
            lastUpdated: doc.lastUpdated,
            source: doc.source,
            ageMinutes: Math.round(ageMinutes),
            isStale: ageMinutes > 1440, // stale po 24h
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/exchange-rates/refresh — admin only, ročno osveži tečaje
const refreshRates = async (req, res, next) => {
    try {
        const response = await axios.get(ECB_URL, { timeout: 10000 });
        const data = response.data;

        if (!data.rates) {
            return res.status(502).json({
                success: false,
                message: "Failed to fetch exchange rates from ECB",
            });
        }

        const doc = await ExchangeRate.updateRates(data.rates, "ECB/Frankfurter");

        res.status(200).json({
            success: true,
            message: "Exchange rates updated",
            base: doc.base,
            rates: doc.rates,
            lastUpdated: doc.lastUpdated,
            source: doc.source,
            count: Object.keys(doc.rates).length,
        });
    } catch (error) {
        console.error("Exchange rate refresh error:", error.message);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to refresh exchange rates",
        });
    }
};

// GET /api/exchange-rates/convert — pretvori znesek
// Query: ?from=EUR&to=USD&amount=100
const convert = async (req, res, next) => {
    try {
        const { from = "EUR", to = "EUR", amount = 1 } = req.query;
        const amt = parseFloat(amount);

        if (isNaN(amt)) {
            return res.status(400).json({ success: false, message: "Invalid amount" });
        }

        // Če sta enaki valuti, ni pretvorbe
        if (from.toUpperCase() === to.toUpperCase()) {
            return res.status(200).json({
                success: true,
                from: from.toUpperCase(),
                to: to.toUpperCase(),
                rate: 1,
                amount: amt,
                converted: amt,
            });
        }

        const doc = await ExchangeRate.getRates();
        const fromRate = from.toUpperCase() === doc.base ? 1 : doc.rates.get(from.toUpperCase());
        const toRate = to.toUpperCase() === doc.base ? 1 : doc.rates.get(to.toUpperCase());

        if (!fromRate || !toRate) {
            return res.status(400).json({
                success: false,
                message: `Exchange rate not available for ${from} or ${to}`,
                available: [doc.base, ...Array.from(doc.rates.keys())],
            });
        }

        // Pretvori preko base valute: amount / fromRate * toRate
        const inBase = amt / fromRate;
        const converted = inBase * toRate;
        const rate = toRate / fromRate;

        res.status(200).json({
            success: true,
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            rate: Math.round(rate * 10000) / 10000,
            amount: amt,
            converted: Math.round(converted * 100) / 100,
        });
    } catch (error) {
        next(error);
    }
};

module.exports = { getRates, refreshRates, convert };
