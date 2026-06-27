const User = require("../models/user.model");
const { validationResult } = require("express-validator");
const genrateToken = require("../utils/genrateToken");

const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: "Validation Error",
                errors: errors.array()
            });
        }

        const EmailExist = await User.findOne({ email });
        if (EmailExist) {
            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });
        }

        const user = await User.create({ name, email, password, role });
        genrateToken(user._id, res);
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
        console.log(error)
    }
};
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }
        genrateToken(user._id, res);
        res.status(200).json({
            success: true,
            message: "User logged in successfully",
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
        console.log(error)
    }
};

/**
 * POST /api/users/pin-login
 * HITRI PIN login za POS terminal — 4-mestna koda namesto email/password.
 *
 * Body: { pin: "1234" }
 * Vrne: { success, user, token } — enako kot email login
 */
const pinLogin = async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin || pin.length !== 4) {
            return res.status(400).json({
                success: false,
                message: "PIN must be 4 digits"
            });
        }

        const user = await User.findOne({ pin, isActive: true, role: { $ne: "client" } })
            .select("-password");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid PIN"
            });
        }

        genrateToken(user._id, res);
        res.status(200).json({
            success: true,
            message: "PIN login successful",
            user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

const getAllStaff = async (req, res) => {
    try {
        const staff = await User.find({ role: { $ne: 'client' } }).select('-password');
        res.status(200).json({
            success: true,
            staff
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

const createNewStaff = async (req, res) => {
    try {
        const { name, email, password, role, pin, designation, permissions, shift, phoneNumber, avatar } = req.body;
        const EmailExist = await User.findOne({ email });
        if (EmailExist) {
            return res.status(400).json({
                success: false,
                message: "Email already exists"
            });
        }

        const user = await User.create({
            name, email, password, role, pin, designation, permissions, shift, phoneNumber, avatar
        });

        res.status(201).json({
            success: true,
            message: "Staff created successfully",
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

const updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Don't allow password update through this endpoint for now
        delete updates.password;

        const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Staff not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Staff updated successfully",
            staff: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

/**
 * PATCH /api/users/staff/:id/pin
 * Nastavi/posodobi PIN za hitri login (admin only).
 * Body: { pin: "1234" }
 */
const updatePin = async (req, res) => {
    try {
        const { id } = req.params;
        const { pin } = req.body;

        if (!pin || !/^\d{4}$/.test(pin)) {
            return res.status(400).json({
                success: false,
                message: "PIN must be exactly 4 digits"
            });
        }

        // Preveri unikatnost PIN-a
        const existing = await User.findOne({ pin, _id: { $ne: id }, isActive: true, role: { $ne: "client" } });
        if (existing) {
            return res.status(400).json({
                success: false,
                message: `PIN already in use by ${existing.name}`
            });
        }

        const user = await User.findByIdAndUpdate(id, { pin }, { new: true }).select('-password');
        if (!user) {
            return res.status(404).json({ success: false, message: "Staff not found" });
        }

        res.status(200).json({
            success: true,
            message: "PIN updated successfully",
            staff: user
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const toggleStaffStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Staff not found"
            });
        }

        user.isActive = !user.isActive;
        await user.save();

        res.status(200).json({
            success: true,
            message: `Staff ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            isActive: user.isActive
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

const deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Staff not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Staff deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};


module.exports = { register, login, pinLogin, getAllStaff, createNewStaff, updateStaff, updatePin, toggleStaffStatus, deleteStaff };