const express = require("express");
const router = express.Router();
const { sendEmail, sendToAdmins } = require("../utils/emailService");
const { protectedRoute, isAdmin } = require("../middlewares/auth.middleware");

// Vsi endpointi zahtevajo admin pravice
router.use(protectedRoute, isAdmin);

/**
 * GET /api/email/status — preveri ali je SMTP konfiguriran
 */
router.get("/status", (req, res) => {
    const configured = process.env.SMTP_ENABLED === "true" &&
                        !!process.env.SMTP_HOST &&
                        !!process.env.SMTP_USER;
    res.status(200).json({
        success: true,
        configured,
        host: process.env.SMTP_HOST || null,
        from: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || null,
    });
});

/**
 * POST /api/email/test — pošlje testni email
 * Body: { to: "email@example.com" }
 */
router.post("/test", async (req, res) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, message: "Email address required" });

    const result = await sendEmail(to, "welcome", {
        name: "Test User",
        role: "admin",
        loginUrl: process.env.CLIENT_URL || "http://localhost:5173",
    });

    if (result.success) {
        res.status(200).json({ success: true, message: `Test email sent to ${to}`, messageId: result.messageId });
    } else {
        res.status(500).json({ success: false, message: result.error || "Failed to send email" });
    }
});

/**
 * POST /api/email/admins — pošlje email vsem adminom
 * Body: { template, data }
 */
router.post("/admins", async (req, res) => {
    const { template, data } = req.body;
    if (!template) return res.status(400).json({ success: false, message: "Template required" });

    const result = await sendToAdmins(template, data);
    res.status(result.success ? 200 : 500).json(result);
});

module.exports = router;
