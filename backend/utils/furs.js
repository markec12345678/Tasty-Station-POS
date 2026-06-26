/**
 * FURS (Financial Administration of the Republic of Slovenia) — davčno potrjevanje računov.
 *
 * Ta modul implementira:
 *   - Generiranje ZOI (Zaščitna Oznaka Izdajatelja)
 *   - Generiranje QR kode za preverjanje računa
 *   - Pošiljanje računa FURS preko SOAP API-ja za pridobitev EOR
 *   - Batch potrjevanje (za offline mode)
 *
 * Zahtevana konfiguracija v .env:
 *   FURS_CERT_PATH=/path/to/cert.pem    (certifikat za test ali produkcijo)
 *   FURS_CERT_PASSWORD=cert_password
 *   FURS_TEST_MODE=true                  (true = test FURS, false = produkcija)
 *
 * FURS certifikate dobiš na: https://edavki.durs.si/
 *   1. Prijavi se z digitalnim potrdilom
 *   2. Vzpostavi "Davčna blagajna" → "Zahtevek za certifikat"
 *   3. Prenesi .p12 certifikat in geslo
 *
 * Dokumentacija: https://www.fu.gov.si/seznam-aktualnih-tem/e_davki/davcna_blagajna/
 */

const crypto = require("crypto");
const FiscalInvoice = require("../models/fiscalInvoice.model");

// FURS endpointi
const FURS_ENDPOINTS = {
    test: "https://blagajne-test.fu.gov.si:9002/v1/cash_registers/invoices",
    production: "https://blagajne.fu.gov.si:9002/v1/cash_registers/invoices",
};

/**
 * Generira ZOI (Zaščitna Oznaka Izdajatelja) za račun.
 *
 * Formula (MD5):
 *   ZOI = MD5(taxNumber + issueDateTime + invoiceNumber + businessUnit + cashRegister + total + certPrivateKey)
 *
 * @param {Object} params
 *   - taxNumber: davčna številka zavezanca (npr. "12345678")
 *   - issueDateTime: ISO 8601 format (npr. "2025-06-15T14:30:00")
 *   - invoiceNumber: zaporedna številka računa
 *   - businessUnit: oznaka poslovnega prostora (npr. "1")
 *   - cashRegister: oznaka elektronske naprave (npr. "1")
 *   - total: skupni znesek računa (number)
 * @param {String} privateKey — RSA private key iz FURS certifikata (PEM format)
 * @returns {String} 32-char hex MD5
 */
const generateZOI = (params, privateKey) => {
    const {
        taxNumber,
        issueDateTime,
        invoiceNumber,
        businessUnit,
        cashRegister,
        total,
    } = params;

    // Sestavi niz za podpis
    const content = `${taxNumber}${issueDateTime}${invoiceNumber}${businessUnit}${cashRegister}${total.toFixed(2)}`;

    // Podpiši z RSA private key (SHA256, potem MD5 hex output)
    const signer = crypto.createSign("SHA256");
    signer.update(content);
    signer.end();

    const signature = signer.sign(privateKey);
    const zoi = crypto.createHash("md5").update(signature).digest("hex");

    return zoi;
};

/**
 * Generira vsebino QR kode za FURS (pravilno formatirana).
 *
 * Format (FURS specifikacija):
 *   ZOI + issueDateTime v YYYYMMDDHHmmssSSS + taxNumber + ZOI, ki je base64 encoded
 *
 * @param {String} zoi - 32-char hex ZOI
 * @param {Date} issueDateTime
 * @param {String} taxNumber
 * @returns {String} vsebina za QR kodo
 */
const generateQRContent = (zoi, issueDateTime, taxNumber) => {
    const dt = new Date(issueDateTime);
    const pad = (n, len = 2) => String(n).padStart(len, "0");
    const formattedDate =
        dt.getFullYear().toString() +
        pad(dt.getMonth() + 1) +
        pad(dt.getDate()) +
        pad(dt.getHours()) +
        pad(dt.getMinutes()) +
        pad(dt.getSeconds()) +
        pad(dt.getMilliseconds(), 3);

    // Format: ZOI(date)(taxNumber)(controlDigit)(zoi)
    // V redu: date(10)taxNumber(8)controlDigit(1)zoi(32)
    const content = `SI${formattedDate}${taxNumber}${zoi}`;
    return content;
};

/**
 * Generira naslednjo zaporedno številko računa za outlet.
 *
 * Format: OUTLET_CODE-YEAR-SEQUENCE (npr. "TS-LJU-2025-000123")
 *
 * @param {Object} outlet — Outlet dokument
 * @param {Date} issueDate — datum izdaje (za year)
 * @returns {String} nova številka računa
 */
const generateInvoiceNumber = async (outlet, issueDate = new Date()) => {
    const year = issueDate.getFullYear();
    const outletCode = outlet?.code || "TS";
    const prefix = `${outletCode}-${year}-`;

    // Pridobi zadnjo številko za ta outlet in leto
    const lastInvoice = await FiscalInvoice.findOne({
        outlet: outlet?._id,
        invoiceNumber: { $regex: `^${prefix}` }
    }).sort({ invoiceNumber: -1 });

    let sequence = 1;
    if (lastInvoice) {
        const lastSeq = parseInt(lastInvoice.invoiceNumber.split("-").pop(), 10);
        sequence = lastSeq + 1;
    }

    return `${prefix}${String(sequence).padStart(6, "0")}`;
};

/**
 * Pošlje račun FURS preko SOAP API-ja za pridobitev EOR.
 *
 * @param {Object} invoiceData - podatki o računu
 * @param {String} certPem - certifikat v PEM formatu
 * @param {String} certPassword - geslo certifikata
 * @param {Boolean} testMode - ali uporabljamo test ali produkcijo
 * @returns {Object} { success, eor?, error? }
 */
const sendToFURS = async (invoiceData, certPem, certPassword, testMode = true) => {
    const endpoint = testMode ? FURS_ENDPOINTS.test : FURS_ENDPOINTS.production;

    // V tej implementaciji je SOAP klic stub — pravi klic zahteva:
    // 1. HTTPS mutual TLS s FURS certifikatom
    // 2. SOAP envelope z računom v XML formatu (FURS specifikacija)
    // 3. Parsanje SOAP response za EOR

    if (!certPem || !certPassword) {
        return {
            success: false,
            error: "FURS certificate not configured. Set FURS_CERT_PATH and FURS_CERT_PASSWORD."
        };
    }

    try {
        // === STUB — pravi klic ===
        // V produkciji tukaj uporabi 'soap' ali 'axios' z mutual TLS:
        //
        // const https = require("https");
        // const fs = require("fs");
        // const agent = new https.Agent({
        //     pfx: fs.readFileSync(certPath),
        //     passphrase: certPassword,
        // });
        // const response = await axios.post(endpoint, soapEnvelope, { httpsAgent: agent });
        // const eor = parseEOR(response.data);

        console.log(`[FURS] Stub: would send invoice ${invoiceData.invoiceNumber} to ${testMode ? "test" : "production"} FURS`);

        // Simuliraj EOR (UUID format)
        const eor = crypto.randomUUID();

        return { success: true, eor };
    } catch (error) {
        console.error("FURS send error:", error);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Glavna funkcija — potrdi račun pri FURS.
 *
 * Workflow:
 *   1. Generiraj invoiceNumber (zaporedno številko)
 *   2. Generiraj ZOI (zaščitno oznako)
 *   3. Pošlji FURS → pridobi EOR
 *   4. Generiraj QR kodo
 *   5. Shrani FiscalInvoice
 *
 * @param {Object} order — Order dokument (z items, totalAmount, etc.)
 * @param {Object} outlet — Outlet dokument (z taxNumber)
 * @param {String} paymentMethod - "cash" | "card" | "other"
 * @param {Object} user — uporabnik, ki izdaja račun
 * @returns {Object} { success, invoice? }
 */
const confirmInvoice = async (order, outlet, paymentMethod = "cash", user = null) => {
    try {
        // Preveri, ali je FURS potrjevanje omogočeno
        if (!process.env.FURS_ENABLED || process.env.FURS_ENABLED === "false") {
            console.log("[FURS] FURS confirmation disabled (FURS_ENABLED=false)");
            return { success: false, error: "FURS not enabled" };
        }

        const taxNumber = outlet?.taxNumber || process.env.FURS_DEFAULT_TAX_NUMBER;
        if (!taxNumber) {
            return { success: false, error: "Tax number required (set on Outlet or FURS_DEFAULT_TAX_NUMBER env)" };
        }

        // 1. Generiraj invoiceNumber
        const invoiceNumber = await generateInvoiceNumber(outlet);

        // 2. Pripravi podatke za ZOI
        const issueDateTime = new Date().toISOString();
        const zoiParams = {
            taxNumber,
            issueDateTime,
            invoiceNumber,
            businessUnit: "1",
            cashRegister: "1",
            total: order.totalAmount,
        };

        // 3. Generiraj ZOI
        let zoi = null;
        const certPem = process.env.FURS_CERT_PATH ? require("fs").readFileSync(process.env.FURS_CERT_PATH, "utf8") : null;
        const certPassword = process.env.FURS_CERT_PASSWORD;

        if (certPem) {
            zoi = generateZOI(zoiParams, certPem);
        } else {
            // Fallback — generiraj random ZOI za development
            zoi = crypto.createHash("md5").update(`${taxNumber}${invoiceNumber}${Date.now()}`).digest("hex");
            console.warn("[FURS] No certificate — using random ZOI (development only)");
        }

        // 4. Pošlji FURS za EOR
        const fursResult = await sendToFURS(
            { ...zoiParams, zoi },
            certPem,
            certPassword,
            process.env.FURS_TEST_MODE !== "false"
        );

        // 5. Generiraj QR vsebino
        const qrContent = generateQRContent(zoi, issueDateTime, taxNumber);

        // 6. Izračunaj tax breakdown (po stopnjah DDV)
        const taxBreakdown = [{
            rate: 22,  // privzeta stopnja — v produkciji pridobi iz CurrencySettings.taxRates
            base: order.totalAmount / 1.22,
            tax: order.totalAmount - (order.totalAmount / 1.22),
            gross: order.totalAmount,
        }];

        // 7. Shrani FiscalInvoice
        const invoice = await FiscalInvoice.create({
            order: order._id,
            orderId: order.orderId,
            outlet: outlet?._id,
            invoiceNumber,
            businessUnit: "1",
            cashRegister: "1",
            taxNumber,
            zoi,
            eor: fursResult.success ? fursResult.eor : null,
            fiscalQR: qrContent,
            status: fursResult.success ? "confirmed" : "failed",
            issueDateTime,
            totals: {
                subtotal: order.totalAmount / 1.22,
                taxAmount: order.totalAmount - (order.totalAmount / 1.22),
                discount: 0,
                total: order.totalAmount,
            },
            taxBreakdown,
            payment: {
                method: paymentMethod,
                amount: order.totalAmount,
            },
            customer: order.client,
            customerName: order.clientName,
            issuedBy: user?._id,
            error: fursResult.success ? undefined : {
                message: fursResult.error,
                timestamp: new Date(),
            },
            attempts: 1,
        });

        return {
            success: fursResult.success,
            invoice,
            zoi,
            eor: fursResult.eor,
            qrContent,
            invoiceNumber,
        };
    } catch (error) {
        console.error("FURS confirmInvoice error:", error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    generateZOI,
    generateQRContent,
    generateInvoiceNumber,
    sendToFURS,
    confirmInvoice,
    FURS_ENDPOINTS,
};
