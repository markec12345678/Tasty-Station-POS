const User = require("../models/user.model");
const { validationResult } = require("express-validator");
const genrateToken = require("../utils/genrateToken");
const { logAction } = require("../middlewares/auditLog.middleware");

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
        const token = genrateToken(user._id, res);
        // Nikoli ne vračaj password hash-a (prejšnje stanje: leak v response).
        const safeUser = user.toObject();
        delete safeUser.password;
        delete safeUser.pin;
        // Audit log — register (non-blocking)
        logAction(req, {
            action: "register",
            entity: "auth",
            entityId: user._id,
            description: `User ${email} registered with role ${role || "client"}`,
            changes: { before: null, after: { email, role: role || "client" } },
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user: safeUser,
            token // za mobilne kliente (web uporablja HttpOnly pišček)
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
            // Audit log — failed login (non-blocking)
            logAction(req, {
                action: "login_failed",
                entity: "auth",
                description: `Failed login attempt for ${email} (user not found)`,
                status: "failed",
                errorMessage: "Invalid credentials",
            }).catch(e => console.error("Audit log error:", e.message));
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            // Audit log — failed login (non-blocking)
            logAction(req, {
                action: "login_failed",
                entity: "auth",
                entityId: user._id,
                description: `Failed login attempt for ${email} (wrong password)`,
                status: "failed",
                errorMessage: "Invalid credentials",
            }).catch(e => console.error("Audit log error:", e.message));
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }
        const token = genrateToken(user._id, res);
        // Nikoli ne vračaj password hash-a (prejšnje stanje: leak v response).
        const safeUser = user.toObject();
        delete safeUser.password;
        delete safeUser.pin;
        // Audit log — login (non-blocking)
        logAction(req, {
            action: "login",
            entity: "auth",
            entityId: user._id,
            description: `User ${email} logged in`,
        }).catch(e => console.error("Audit log error:", e.message));

        res.status(200).json({
            success: true,
            message: "User logged in successfully",
            user: safeUser,
            token // za mobilne kliente (web uporablja HttpOnly pišček)
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
        if (!pin || !/^\d{4}$/.test(pin)) {
            return res.status(400).json({
                success: false,
                message: "PIN must be 4 digits"
            });
        }

        // PIN-i so sedaj hashirani (bcrypt) — ne moremo jih iskati z direktnim
        // queryjem. Pridobimo vse kandidate (aktivni osebje s PIN-om) in
        // uporabimo varno primerjavo. N je majhen (samo osebje).
        const candidates = await User.find({
            isActive: true,
            role: { $ne: "client" },
            pin: { $ne: null, $exists: true },
        }).select("-password");

        let user = null;
        for (const candidate of candidates) {
            if (await candidate.comparePin(pin)) {
                user = candidate;
                break;
            }
        }

        if (!user) {
            // Audit log — failed PIN login (non-blocking)
            logAction(req, {
                action: "login_failed",
                entity: "auth",
                description: `Failed PIN login attempt`,
                status: "failed",
                errorMessage: "Invalid PIN",
            }).catch(e => console.error("Audit log error:", e.message));
            return res.status(401).json({
                success: false,
                message: "Invalid PIN"
            });
        }

        // Audit log — PIN login success (non-blocking)
        logAction(req, {
            action: "login",
            entity: "auth",
            entityId: user._id,
            description: `User ${user.email} logged in via PIN`,
        }).catch(e => console.error("Audit log error:", e.message));

        const token = genrateToken(user._id, res);
        const safeUser = user.toObject();
        delete safeUser.pin;
        res.status(200).json({
            success: true,
            message: "PIN login successful",
            user: safeUser,
            token // za mobilne kliente (web uporablja HttpOnly pišček)
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
        const staff = await User.find({ role: { $ne: 'client' } }).select('-password -pin');
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

        // Audit log — user_create (non-blocking)
        logAction(req, {
            action: "user_create",
            entity: "user",
            entityId: user._id,
            description: `Staff ${name} (${email}) created with role ${role} by ${req.user?.email}`,
            changes: { before: null, after: { name, email, role } },
        }).catch(e => console.error("Audit log error:", e.message));

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

        const user = await User.findByIdAndUpdate(id, updates, { new: true }).select('-password -pin');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "Staff not found"
            });
        }

        // Audit log — user_update (non-blocking)
        logAction(req, {
            action: "user_update",
            entity: "user",
            entityId: user._id,
            description: `Staff ${user.name} (${user.email}) updated by ${req.user?.email}`,
            changes: { before: { ...updates }, after: { name: user.name, role: user.role, isActive: user.isActive } },
        }).catch(e => console.error("Audit log error:", e.message));

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

        // Preveri unikatnost PIN-a — ker so hashirani, moramo primerjati
        // z comparePin čez vse kandidate (razen trenutnega uporabnika).
        const candidates = await User.find({
            _id: { $ne: id },
            isActive: true,
            role: { $ne: "client" },
            pin: { $ne: null, $exists: true },
        });
        for (const c of candidates) {
            if (await c.comparePin(pin)) {
                return res.status(400).json({
                    success: false,
                    message: `PIN already in use by ${c.name}`
                });
            }
        }

        // Uporabimo findById + save() (ne findByIdAndUpdate), da se pre("save")
        // hook za hashing PIN-a pravilno sproži.
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: "Staff not found" });
        }
        user.pin = pin;
        await user.save();
        const safeUser = user.toObject();
        delete safeUser.password;
        delete safeUser.pin;

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

        // Audit log — user_delete (non-blocking)
        logAction(req, {
            action: "user_delete",
            entity: "user",
            entityId: id,
            description: `Staff ${user.name} (${user.email}) deleted by ${req.user?.email}`,
            changes: { before: { name: user.name, email: user.email, role: user.role }, after: null },
        }).catch(e => console.error("Audit log error:", e.message));
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