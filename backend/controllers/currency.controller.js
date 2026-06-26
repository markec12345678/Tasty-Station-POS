const CurrencySettings = require("../models/currencySettings.model");

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
        Object.assign(settings, req.body);
        await settings.save();
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
        const { name, ...presetData } = preset;
        Object.assign(settings, presetData);
        await settings.save();
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
