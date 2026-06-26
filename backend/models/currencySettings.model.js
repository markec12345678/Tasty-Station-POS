const mongoose = require("mongoose");

/**
 * CurrencySettings — globalne nastavitve valute in formatiranja.
 * Single document (singleton) — pridobi se vedno prvi dokument.
 *
 * Podprte valute: EUR, USD, Rs (PKR), GBP, CHF, HRK, RSD
 * Slovenija privzeto: EUR z 22% DDV (splošna stopnja)
 */
const currencySettingsSchema = new mongoose.Schema({
    // ISO 4217 koda valute
    code: {
        type: String,
        default: "EUR",
        uppercase: true,
        trim: true,
    },
    // Simbol valute (€, $, Rs, £)
    symbol: {
        type: String,
        default: "€",
    },
    // Pozicija simbola glede na znesek
    symbolPosition: {
        type: String,
        enum: ["before", "after"],
        default: "after", // EUR: "10 €" | USD: "$10"
    },
    // Število decimalnih mest (običajno 2, JPY = 0)
    decimals: {
        type: Number,
        default: 2,
        min: 0,
        max: 4,
    },
    // Locales za formatiranje (npr. "sl-SI", "en-US", "en-PK")
    locale: {
        type: String,
        default: "sl-SI",
    },
    // Ločilo tisočic (3.000 ali 3,000)
    thousandsSeparator: {
        type: String,
        default: ".",
    },
    // Ločilo decimalk
    decimalSeparator: {
        type: String,
        default: ",",
    },
    // DDV stopnje za Slovenijo (prilagodljive)
    // Splošna 22%, Znižana 9.5%, Posebej znižana 5%
    taxRates: {
        standard: { type: Number, default: 22 },      // splošna stopnja
        reduced: { type: Number, default: 9.5 },      // znižana stopnja
        specialReduced: { type: Number, default: 5 }, // posebej znižana stopnja
    },
    // Ali naj se DDV prikaže vključen v ceno artiklov (Slovenija: da)
    taxInclusive: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

// Static method: pridobi singleton settings
currencySettingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

// Method: formatiraj znesek glede na nastavitve
currencySettingsSchema.methods.format = function(amount) {
    if (typeof amount !== "number" || isNaN(amount)) amount = 0;
    const fixed = amount.toFixed(this.decimals);
    const [intPart, decPart] = fixed.split(".");
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, this.thousandsSeparator);
    const formatted = decPart
        ? `${formattedInt}${this.decimalSeparator}${decPart}`
        : formattedInt;
    return this.symbolPosition === "before"
        ? `${this.symbol}${formatted}`
        : `${formatted} ${this.symbol}`;
};

// Method: formatiraj brez simbola (npr. za račune)
currencySettingsSchema.methods.formatAmount = function(amount) {
    if (typeof amount !== "number" || isNaN(amount)) amount = 0;
    const fixed = amount.toFixed(this.decimals);
    const [intPart, decPart] = fixed.split(".");
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, this.thousandsSeparator);
    return decPart
        ? `${formattedInt}${this.decimalSeparator}${decPart}`
        : formattedInt;
};

const CurrencySettings = mongoose.models.CurrencySettings || mongoose.model("CurrencySettings", currencySettingsSchema);
module.exports = CurrencySettings;
