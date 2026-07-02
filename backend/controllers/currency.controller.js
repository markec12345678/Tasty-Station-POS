const CurrencySettings = require("../models/currencySettings.model");
const { logAction } = require("../middlewares/auditLog.middleware");

// Preddefinirane valute za hitro nastavljanje
const PRESET_CURRENCIES = {
    EUR: { code: "EUR", symbol: "€", symbolPosition: "after", decimals: 2, locale: "sl-SI", thousandsSeparator: ".", decimalSeparator: ",", taxRates: { standard: 22, reduced: 9.5, specialReduced: 5 }, taxInclusive: true, name: "Euro (Slovenia)" },
    USD: { code: "USD", symbol: "$", symbolPosition: "before", decimals: 2, locale: "en-US", thousandsSeparator: ",", decimalSeparator: ".", taxRates: { standard: 0, reduced: 0, specialReduced: 0 }, taxInclusive: false, name: "US Dollar" },
    PKR: { code: "PKR", symbol: "Rs", symbolPosition: "before", decimals: 0, locale: "en-PK", thousandsSeparator: ",", decimalSeparator: ".", taxRates: { standard: 17, reduced: 0, specialReduced: 0 }, taxInclusive: false, name: "Pakistani Rupee" },
    GBP: { code: "GBP", symbol: "£", symbolPosition: "before", decimals: 2, locale: "en-GB", thousandsSeparator: ",", decimalSeparator: ".", taxRates: { standard: 20, reduced: 5, specialReduced: 0 }, taxInclusive: true, name: "British Pound" },
    CHF: { code: "CHF", symbol: "CHF", symbolPosition: "after", decimals: 2, locale: "de-CH", thousandsSeparator: "'", decimalSeparator: ".", taxRates: { standard: 7.7, reduced: 2.5, specialReduced: 3.7 }, taxInclusive: true, name: "Swiss Franc" },
    HRK: { code: "HRK", symbol: "kn", symbolPosition: "after", decimals: 2, locale: "hr-HR", thousandsSeparator: ".", decimalSeparator: ",", taxRates: { standard: 25, reduced: 13, specialReduced: 5 }, taxInclusive: true, name: "Croatian Kuna" },
    RSD: { code: "RSD", symbol: "din", symbolPosition: "after", decimals: 0, locale: "sr-RS", thousandsSeparator: ".", decimalSeparator: ",", taxRates: { standard: 20, reduced: 10, specialReduced: 0 }, taxInclusive: true, name: "Serbian Dinar" },
};

// GET /api/currency — javni endpoint, vrne trenutne nastavitve valute
const getCurrencySettings = async (req, res, next) => {
    try {
        const settings = await CurrencySettings.getSettings();
        res.status(200).json({
            success: true,
            settings,
            presets: Object.keys(PRESET_CURRENCIES).map(k => ({ code: k, name: PRESET_CURRENCIES[k].name }))
        });
    } catch (error) {
        next(error);
    }
};

// PUT /api/currency — admin-only, posodobi nastavitve
const updateCurrencySettings = async (req, res, next) => {
    try {
        const settings = await CurrencySettings.getSettings();
        const before = settings.toObject();
        Object.assign(settings, req.body);
        await settings.save();

        // Audit log — currency_update (non-blocking)
        logAction(req, {
            action: "currency_update",
            entity: "currency",
            description: `Currency settings updated by ${req.user?.email} (code: ${settings.code}, standard tax: ${settings.taxRates?.standard}%)`,
            changes: { before: { code: before.code, symbol: before.symbol, taxInclusive: before.taxInclusive }, after: { code: settings.code, symbol: settings.symbol, taxInclusive: settings.taxInclusive } },
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(200).json({ success: true, message: "Currency settings updated", settings });
    } catch (error) {
        next(error);
    }
};

// POST /api/currency/preset/:code — admin-only, hitro nastavi prednastavljeno valuto
const applyPreset = async (req, res, next) => {
    try {
        const { code } = req.params;
        const preset = PRESET_CURRENCIES[code.toUpperCase()];
        if (!preset) {
            return res.status(400).json({
                success: false,
                message: `Unknown currency preset: ${code}. Available: ${Object.keys(PRESET_CURRENCIES).join(", ")}`
            });
        }
        const settings = await CurrencySettings.getSettings();
        const before = settings.toObject();
        const { name: _name, ...presetData } = preset;
        Object.assign(settings, presetData);
        await settings.save();

        // Audit log — currency_preset_apply (non-blocking)
        logAction(req, {
            action: "currency_preset_apply",
            entity: "currency",
            description: `Currency switched to ${preset.name} by ${req.user?.email}`,
            changes: { before: { code: before.code }, after: { code: settings.code } },
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(200).json({
            success: true,
            message: `Currency switched to ${preset.name}`,
            settings
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/currency/presets — vrne vse prednastavljene valute
const getPresets = async (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            presets: Object.entries(PRESET_CURRENCIES).map(([code, data]) => ({
                code,
                name: data.name,
                symbol: data.symbol,
                symbolPosition: data.symbolPosition,
                standardTaxRate: data.taxRates.standard,
            }))
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getCurrencySettings,
    updateCurrencySettings,
    applyPreset,
    getPresets,
    PRESET_CURRENCIES,
};
