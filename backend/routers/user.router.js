const { register, login, pinLogin, getAllStaff, createNewStaff, updateStaff, updatePin, toggleStaffStatus, deleteStaff } = require('../controllers/user.controller');
const { body } = require('express-validator');
const { protectedRoute } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/rbac.middleware');
const User = require('../models/user.model');
const router = require('express').Router();

// Public auth routes
router.post('/register',
    [
        body("name").trim().notEmpty().withMessage("Name is required"),
        body("email").trim().isEmail().withMessage("Invalid email format").normalizeEmail(),
        body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),
        body("role").optional().isIn(["admin", "cashier", "client", "kitchen", "waiter"]).withMessage("Invalid role")
    ],
    register);

router.post('/login',
    [
        body("email").trim().isEmail().withMessage("Invalid email format").normalizeEmail(),
        body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters long")
    ],
    login);

// PIN quick login — POS terminal
router.post('/pin-login', pinLogin);

router.get('/me', protectedRoute, (req, res) => {
    res.json(req.user);
});

// Push notification token registration
router.post('/push-token', protectedRoute, async (req, res) => {
    try {
        const { pushToken } = req.body;
        if (!pushToken || !pushToken.startsWith("ExponentPushToken")) {
            return res.status(400).json({ success: false, message: "Invalid push token" });
        }
        await User.findByIdAndUpdate(req.user._id, { pushToken });
        res.status(200).json({ success: true, message: "Push token registered" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/logout', (req, res) => {
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("token", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
    });
    res.json({
        success: true,
        message: "User logged out successfully"
    });
});

// Staff Management Routes (RBAC protected)
router.get('/staff', protectedRoute, requirePermission("users:read"), getAllStaff);
router.post('/staff', protectedRoute, requirePermission("users:create"), createNewStaff);
router.put('/staff/:id', protectedRoute, requirePermission("users:update"), updateStaff);
router.patch('/staff/:id/pin', protectedRoute, requirePermission("users:update"), updatePin);
router.patch('/staff/:id/status', protectedRoute, requirePermission("users:update"), toggleStaffStatus);
router.delete('/staff/:id', protectedRoute, requirePermission("users:delete"), deleteStaff);

module.exports = router;
