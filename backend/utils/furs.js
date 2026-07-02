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
const CurrencySettings = require("../models/currencySettings.model");

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
 * Implementacija uporablja Node.js native https z mutual TLS (.p12 certifikat).
 * SOAP envelope je zgrajen po FURS specifikaciji (v1.3).
 *
 * Zahteve:
 *   - FURS_CERT_PATH: pot do .p12 certifikata (prenesi z edavki.durs.si)
 *   - FURS_CERT_PASSWORD: geslo certifikata
 *   - FURS_TEST_MODE: true (test) ali false (produkcija)
 *
 * @param {Object} invoiceData - podatki o računu
 *   - taxNumber, invoiceNumber, issueDateTime, businessUnit, cashRegister, total, zoi
 * @param {String} certPath - pot do .p12 certifikata
 * @param {String} certPassword - geslo certifikata
 * @param {Boolean} testMode - ali uporabljamo test ali produkcijo
 * @returns {Object} { success, eor?, error? }
 */
const sendToFURS = async (invoiceData, certPath, certPassword, testMode = true) => {
    const fs = require("fs");
    const https = require("https");

    const endpoint = testMode ? FURS_ENDPOINTS.test : FURS_ENDPOINTS.production;

    if (!certPath || !certPassword) {
        return {
            success: false,
            error: "FURS certificate not configured. Set FURS_CERT_PATH and FURS_CERT_PASSWORD."
        };
    }

    if (!fs.existsSync(certPath)) {
        return {
            success: false,
            error: `Certificate file not found: ${certPath}`
        };
    }

    try {
        // Preberi .p12 certifikat
        const pfx = fs.readFileSync(certPath);

        // Zgradi SOAP envelope po FURS specifikaciji
        const soapEnvelope = buildSOAPEnvelope(invoiceData);

        // Ustvari HTTPS agent z mutual TLS
        const agent = new https.Agent({
            pfx: pfx,
            passphrase: certPassword,
            rejectUnauthorized: true,
        });

        // Pošlji SOAP request
        const response = await new Promise((resolve, reject) => {
            const url = new URL(endpoint);
            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname,
                method: "POST",
                headers: {
                    "Content-Type": "application/soap+xml; charset=utf-8",
                    "Content-Length": Buffer.byteLength(soapEnvelope),
                    "SOAPAction": "http://www.fu.gov.si/v2/cash_registers/invoices",
                },
                agent: agent,
                timeout: 30000,
            };

            const req = https.request(options, (res) => {
                let data = "";
                res.on("data", (chunk) => data += chunk);
                res.on("end", () => resolve({ statusCode: res.statusCode, data }));
            });

            req.on("error", reject);
            req.on("timeout", () => { req.destroy(); reject(new Error("FURS request timeout (30s)")); });
            req.write(soapEnvelope);
            req.end();
        });

        if (response.statusCode === 200) {
            // Uspeh — parsiraj EOR iz SOAP response
            const eor = parseEORFromResponse(response.data);
            if (eor) {
                console.log(`[FURS] Invoice ${invoiceData.invoiceNumber} confirmed. EOR: ${eor}`);
                return { success: true, eor };
            } else {
                // EOR ni najden — preveri za napake v response
                const errorMsg = parseErrorFromResponse(response.data);
                return { success: false, error: errorMsg || "EOR not found in FURS response" };
            }
        } else {
            // HTTP napaka
            const errorMsg = parseErrorFromResponse(response.data) || `HTTP ${response.statusCode}`;
            console.error(`[FURS] HTTP ${response.statusCode}:`, errorMsg);
            return { success: false, error: errorMsg };
        }
    } catch (error) {
        console.error("[FURS] SOAP call error:", error.message);
        return {
            success: false,
            error: error.message,
        };
    }
};

/**
 * Zgradi SOAP envelope za FURS potrjevanje računa.
 * Specifikacija: FURS SOAP v1.3 (fu.gov.si)
 *
 * @param {Object} data — { taxNumber, invoiceNumber, issueDateTime, businessUnit, cashRegister, total, zoi, taxRate }
 * @param {Number} data.taxRate — DDV stopnja v procentih (npr. 22). Če ni podana, default 22.
 * @returns {String} XML SOAP envelope
 */
const buildSOAPEnvelope = (data) => {
    const { taxNumber, invoiceNumber, issueDateTime, businessUnit, cashRegister, total, zoi } = data;
    // DDV stopnja iz CurrencySettings (prej hardcoded 22% — ne-kompatibilno za znižane stopnje).
    const taxRate = (typeof data.taxRate === "number" && data.taxRate >= 0) ? data.taxRate : 22;
    const taxMultiplier = 1 + taxRate / 100;

    // Formatiraj datum za FURS (ISO 8601 z mikro-sekundami)
    const fursDate = issueDateTime.replace(/\.(\d{3})Z$/, ".$1000Z");

    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
               xmlns:ns="http://www.fu.gov.si/v2/cash_registers/invoices">
  <soap:Body>
    <ns:InvoiceRequest>
      <Header>
        <MessageID>${crypto.randomUUID()}</MessageID>
        <DateTime>${fursDate}</DateTime>
      </Header>
      <Signature>
        <ProtectedID>${zoi}</ProtectedID>
      </Signature>
      <Invoice>
        <TaxNumber>${taxNumber}</TaxNumber>
        <IssueDateTime>${fursDate}</IssueDateTime>
        <SubsequentSubmit>false</SubsequentSubmit>
        <InvoiceNumber xmlns="http://www.fu.gov.si/v2/cash_registers/invoices">
          <BusinessPremiseID>${businessUnit || "1"}</BusinessPremiseID>
          <ElectronicDeviceID>${cashRegister || "1"}</ElectronicDeviceID>
          <InvoiceNumber>${invoiceNumber}</InvoiceNumber>
        </InvoiceNumber>
        <InvoiceAmount>${total.toFixed(2)}</InvoiceAmount>
        <PaymentAmount>${total.toFixed(2)}</PaymentAmount>
        <TaxesPerSeller>
          <VAT>
            <TaxRate>${taxRate.toFixed(2)}</TaxRate>
            <TaxableAmount>${(total / taxMultiplier).toFixed(2)}</TaxableAmount>
            <TaxAmount>${(total - total / taxMultiplier).toFixed(2)}</TaxAmount>
          </VAT>
        </TaxesPerSeller>
        <OperatorTaxNumber>${taxNumber}</OperatorTaxNumber>
      </Invoice>
    </ns:InvoiceRequest>
  </soap:Body>
</soap:Envelope>`;
};

/**
 * Parsiraj EOR (Enkratna Identifikacijska Oznaka Računa) iz SOAP response.
 * EOR je UUID format, vrača se v <UniqueInvoiceID> elementu.
 *
 * @param {String} xml — SOAP response XML
 * @returns {String|null} EOR ali null
 */
const parseEORFromResponse = (xml) => {
    // Poskusi z regex (enostavno)
    const eorMatch = xml.match(/<UniqueInvoiceID[^>]*>([^<]+)<\/UniqueInvoiceID>/i);
    if (eorMatch) {
        return eorMatch[1].trim();
    }

    // Alternativni element (FURS lahko vrača v različnih imenskih prostorih)
    const eorMatch2 = xml.match(/(?:EOR|eor|uniqueInvoiceId)[^>]*>([a-f0-9-]{36})</i);
    if (eorMatch2) {
        return eorMatch2[1].trim();
    }

    return null;
};

/**
 * Parsiraj error message iz FURS SOAP response.
 *
 * @param {String} xml — SOAP response XML
 * @returns {String|null} error message ali null
 */
const parseErrorFromResponse = (xml) => {
    const errorCodeMatch = xml.match(/<errorCode[^>]*>([^<]+)<\/errorCode>/i);
    const errorMsgMatch = xml.match(/<errorMessage[^>]*>([^<]+)<\/errorMessage>/i);

    if (errorCodeMatch && errorMsgMatch) {
        return `FURS Error ${errorCodeMatch[1]}: ${errorMsgMatch[1]}`;
    }
    if (errorMsgMatch) {
        return errorMsgMatch[1].trim();
    }

    // Generic SOAP fault
    const faultMatch = xml.match(/<faultstring[^>]*>([^<]+)<\/faultstring>/i);
    if (faultMatch) {
        return `SOAP Fault: ${faultMatch[1].trim()}`;
    }

    return null;
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

        // Pridobi DDV stopnjo: prioritetno iz order.taxRate (self-describing),
        // sicer iz CurrencySettings.taxRates.standard. Prej hardcoded 22%.
        let taxRate = null;
        if (typeof order.taxRate === "number" && order.taxRate >= 0) {
            taxRate = order.taxRate;
        } else {
            try {
                const settings = await CurrencySettings.getSettings();
                taxRate = settings.taxRates?.standard ?? 22;
            } catch {
                taxRate = 22; // fallback
            }
        }
        const taxMultiplier = 1 + taxRate / 100;

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
        const certPath = process.env.FURS_CERT_PATH || null;
        const certPassword = process.env.FURS_CERT_PASSWORD;

        if (certPath) {
            // Za pravi ZOI potrebujemo RSA private key iz .p12 certifikata
            // Uporabi crypto.createPrivateKey za ekstrakcijo
            try {
                const fs = require("fs");
                const crypto = require("crypto");
                const pfxBuffer = fs.readFileSync(certPath);
                const keyObject = crypto.createPrivateKey({
                    key: pfxBuffer,
                    format: "p12",
                    passphrase: certPassword,
                });
                const privateKeyPem = keyObject.export({ type: "pkcs1", format: "pem" });
                zoi = generateZOI(zoiParams, privateKeyPem);
            } catch (e) {
                console.warn("[FURS] Cannot extract private key from .p12, using random ZOI:", e.message);
                zoi = crypto.createHash("md5").update(`${taxNumber}${invoiceNumber}${Date.now()}`).digest("hex");
            }
        } else {
            // Fallback — generiraj random ZOI za development
            zoi = crypto.createHash("md5").update(`${taxNumber}${invoiceNumber}${Date.now()}`).digest("hex");
            console.warn("[FURS] No certificate — using random ZOI (development only)");
        }

        // 4. Pošlji FURS za EOR (podaj taxRate za dinamično DDV stopnjo)
        const fursResult = await sendToFURS(
            { ...zoiParams, zoi, taxRate },
            certPath,
            certPassword,
            process.env.FURS_TEST_MODE !== "false"
        );

        // 5. Generiraj QR vsebino
        const qrContent = generateQRContent(zoi, issueDateTime, taxNumber);

        // 6. Izračunaj tax breakdown (po stopnjah DDV) — dinamična stopnja
        const taxableBase = order.totalAmount / taxMultiplier;
        const taxBreakdown = [{
            rate: taxRate,
            base: taxableBase,
            tax: order.totalAmount - taxableBase,
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
                subtotal: taxableBase,
                taxAmount: order.totalAmount - taxableBase,
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
    buildSOAPEnvelope,
    parseEORFromResponse,
    parseErrorFromResponse,
    confirmInvoice,
    FURS_ENDPOINTS,
};
