/**
 * Email service — pošiljanje email obvestil (nodemailer).
 *
 * Podprti tipi obvestil:
 *   - orderReady: stranki ko je naročilo pripravljeno
 *   - loyaltyTierUpgrade: stranki ko pride v višji tier
 *   - lowStockAlert: adminu ko zaloga pade pod reorder level
 *   - dailyReport: adminu dnevni povzetek prodaje
 *   - welcome: novi uporabnik / stranka
 *
 * Konfiguracija v .env:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=your@email.com
 *   SMTP_PASSWORD=your_app_password
 *   SMTP_FROM_NAME=Tasty Station POS
 *   SMTP_FROM_EMAIL=noreply@tastystation.si
 *   SMTP_ENABLED=true
 */

const nodemailer = require("nodemailer");

let transporter = null;

const getTransporter = () => {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || process.env.SMTP_ENABLED !== "true") {
        return null;
    }

    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: process.env.SMTP_PORT === "465",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        });
    }
    return transporter;
};

const getFromAddress = () => {
    const name = process.env.SMTP_FROM_NAME || "Tasty Station POS";
    const email = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "noreply@tastystation.si";
    return `"${name}" <${email}>`;
};

// === Email templates ===

const templates = {
    orderReady: (data) => ({
        subject: `🍽️ Vaše naročilo ${data.orderId} je pripravljeno!`,
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                <div style="background: #0d9488; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">Tasty Station</h1>
                    <p style="margin: 5px 0 0; opacity: 0.9;">Naročilo pripravljeno</p>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px;">Pozdravljeni ${data.customerName},</p>
                    <p>Vaše naročilo <b>${data.orderId}</b> je pripravljeno za prevzem!</p>
                    <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                        <p style="margin: 0; color: #64748b; font-size: 13px;">Miza</p>
                        <p style="margin: 5px 0 15px; font-weight: bold;">${data.table || "—"}</p>
                        <p style="margin: 0; color: #64748b; font-size: 13px;">Število artiklov</p>
                        <p style="margin: 5px 0 15px; font-weight: bold;">${data.itemCount}</p>
                        <p style="margin: 0; color: #64748b; font-size: 13px;">Skupni znesek</p>
                        <p style="margin: 5px 0; font-weight: bold; font-size: 18px; color: #0d9488;">€${data.totalAmount?.toFixed(2)}</p>
                    </div>
                    <p style="font-size: 13px; color: #64748b;">Prosimo, prevzemite naročilo pri natakarju. Plačilo izvedete ob prevzemu.</p>
                    <p style="font-size: 13px; color: #64748b; margin-top: 20px;">Hvala za vaše naročilo! 🙏</p>
                </div>
            </div>
        `,
    }),

    loyaltyTierUpgrade: (data) => ({
        subject: `🎉 Čestitamo! Dosegli ste ${data.newTier} tier!`,
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                <div style="background: #8b5cf6; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">🎉 Tier Upgrade!</h1>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px;">Pozdravljeni ${data.customerName},</p>
                    <p>Čestitamo! Dosegli ste <b style="color: ${data.tierColor || '#8b5cf6'};">${data.newTier}</b> tier v našem loyalty programu!</p>
                    <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                        <p style="margin: 0 0 10px; font-size: 13px; color: #64748b;">Vaše točke: <b>${data.points}</b></p>
                        <p style="margin: 0; font-size: 13px; color: #64748b;">Skupna poraba: <b>€${data.totalSpent?.toFixed(2)}</b></p>
                    </div>
                    <p style="font-size: 14px;">Sedaj zaslužite <b>${data.multiplier}x</b> točk za vsak evro porabe!</p>
                    <p style="font-size: 13px; color: #64748b; margin-top: 20px;">Preverite razpoložljive nagrade v aplikaciji.</p>
                </div>
            </div>
        `,
    }),

    lowStockAlert: (data) => ({
        subject: `⚠️ Nizka zaloga: ${data.itemName}`,
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                <div style="background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px;">⚠️ Opozorilo o zalogi</h1>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px;">
                    <p>Artikel <b>${data.itemName}</b> ima nizko zalogo.</p>
                    <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                        <p style="margin: 0 0 8px;">Trenutna zaloga: <b style="color: #ef4444;">${data.currentStock} ${data.unit}</b></p>
                        <p style="margin: 0 0 8px;">Reorder level: <b>${data.reorderLevel} ${data.unit}</b></p>
                        <p style="margin: 0;">Dobavitelj: ${data.supplier || "—"}</p>
                    </div>
                    <p style="font-size: 13px; color: #64748b;">Prosimo, naročite novo zalogo.</p>
                </div>
            </div>
        `,
    }),

    welcome: (data) => ({
        subject: `Dobrodošli v Tasty Station! 🍽️`,
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                <div style="background: #0d9488; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">Dobrodošli! 🎉</h1>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px;">
                    <p style="font-size: 16px;">Pozdravljeni ${data.name},</p>
                    <p>Dobrodošli v Tasty Station POS sistemu!</p>
                    <p>Vaš račun je uspešno ustvarjen z vlogo: <b>${data.role}</b>.</p>
                    <div style="background: white; padding: 15px; border-radius: 6px; margin: 15px 0; text-align: center;">
                        <a href="${data.loginUrl}" style="display: inline-block; background: #0d9488; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold;">Prijava v sistem</a>
                    </div>
                    <p style="font-size: 13px; color: #64748b;">Za pomoč kontaktirajte administratorja.</p>
                </div>
            </div>
        `,
    }),

    dailyReport: (data) => ({
        subject: `📊 Dnevno poročilo — ${data.date}`,
        html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
                <div style="background: #0d9488; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
                    <h1 style="margin: 0; font-size: 20px;">📊 Dnevno poročilo</h1>
                    <p style="margin: 5px 0 0; opacity: 0.9;">${data.date}</p>
                </div>
                <div style="background: #f8fafc; padding: 20px; border-radius: 0 0 8px 8px;">
                    <div style="background: white; padding: 15px; border-radius: 6px; margin: 10px 0;">
                        <p style="margin: 0 0 8px; font-size: 13px; color: #64748b;">Skupni prihodek</p>
                        <p style="margin: 0; font-size: 24px; font-weight: bold; color: #0d9488;">€${data.revenue?.toFixed(2)}</p>
                    </div>
                    <div style="display: flex; gap: 10px; margin: 10px 0;">
                        <div style="flex: 1; background: white; padding: 12px; border-radius: 6px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #64748b;">Naročila</p>
                            <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold;">${data.orderCount}</p>
                        </div>
                        <div style="flex: 1; background: white; padding: 12px; border-radius: 6px; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #64748b;">Povprečno</p>
                            <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold;">€${data.avgOrder?.toFixed(2)}</p>
                        </div>
                    </div>
                    <p style="font-size: 13px; color: #64748b; margin-top: 15px;">Top artikli: ${data.topItems?.join(", ") || "—"}</p>
                </div>
            </div>
        `,
    }),
};

/**
 * Pošlje email obvestilo.
 *
 * @param {String} to — email naslovnik
 * @param {String} templateName — ime template-a (orderReady, loyaltyTierUpgrade, lowStockAlert, welcome, dailyReport)
 * @param {Object} data — podatki za template
 * @returns {Object} { success, messageId?, error? }
 */
const sendEmail = async (to, templateName, data = {}) => {
    try {
        const transport = getTransporter();
        if (!transport) {
            console.log(`[Email] SMTP not configured — skipping ${templateName} to ${to}`);
            return { success: false, error: "SMTP not configured" };
        }

        const template = templates[templateName];
        if (!template) {
            return { success: false, error: `Unknown template: ${templateName}` };
        }

        const { subject, html } = template(data);

        const info = await transport.sendMail({
            from: getFromAddress(),
            to,
            subject,
            html,
        });

        console.log(`[Email] Sent ${templateName} to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email] Failed to send ${templateName} to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Pošlje email vsem adminom (za sistemska obvestila).
 */
const sendToAdmins = async (templateName, data) => {
    try {
        const User = require("../models/user.model");
        const admins = await User.find({ role: "admin", isActive: true }).select("email").lean();
        const adminEmails = admins.filter(a => a.email).map(a => a.email);

        if (adminEmails.length === 0) {
            return { success: false, error: "No admin emails found" };
        }

        const results = await Promise.all(
            adminEmails.map(email => sendEmail(email, templateName, data))
        );

        const successCount = results.filter(r => r.success).length;
        return { success: successCount > 0, sent: successCount, total: adminEmails.length };
    } catch (error) {
        console.error("[Email] sendToAdmins error:", error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendEmail,
    sendToAdmins,
    templates,
    getTransporter,
};
