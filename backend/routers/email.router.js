const express = require("express");
const router = express.Router();
const { protectedRoute, isAdmin } = require("../middlewares/auth.middleware");

let sendEmail, sendToAdmins;
try {
    const emailService = require("../utils/emailService");
    sendEmail = emailService.sendEmail;
    sendToAdmins = emailService.sendToAdmins;
} catch (_e) {
    sendEmail = async () => ({ success: false, error: "Email service not configured" });
    sendToAdmins = async () => ({ success: false, error: "Email service not configured" });
}

router.use(protectedRoute, isAdmin);

router.get("/status", (req, res) => {
    const configured = process.env.SMTP_ENABLED === "true" && !!process.env.SMTP_HOST && !!process.env.SMTP_USER;
    res.status(200).json({ success: true, configured, host: process.env.SMTP_HOST || null });
});

router.post("/test", async (req, res) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ success: false, message: "Email address required" });
    const result = await sendEmail(to, "welcome", { name: "Test", role: "admin", loginUrl: process.env.CLIENT_URL || "http://localhost:5173" });
    res.status(result.success ? 200 : 500).json(result);
});

router.post("/admins", async (req, res) => {
    const { template, data } = req.body;
    if (!template) return res.status(400).json({ success: false, message: "Template required" });
    const result = await sendToAdmins(template, data);
    res.status(result.success ? 200 : 500).json(result);
});

module.exports = router;
