const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const protectedRoute = async (req, res, next) => {
    try {
        // 1. Poskusi prebrati token iz HttpOnly piščka (web klienti).
        // 2. Fallback: Authorization: Bearer <token> (mobilni klienti — RN ne
        //    persistira piščkov, zato pošlje JWT kot Bearer header).
        let token = req.cookies.token;
        if (!token) {
            const authHeader = req.headers.authorization || req.headers.Authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                token = authHeader.slice(7);
            }
        }
        if (!token) {
            console.log("Auth Middleware: No Token Provided");
            return res.status(401).json({
                success: false,
                message: "Unauthorized - No Token Provided"
            })
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            console.log("Auth Middleware: Invalid Token");
            return res.status(401).json({
                success: false,
                message: "Unauthorized - Invalid Token"
            })
        }
        const user = await User.findById(decoded.userId).select('-password -pin');
        if (!user) {
            console.log("Auth Middleware: User Not Found for ID:", decoded.userId);
            return res.status(401).json({
                success: false,
                message: "Unauthorized - User Not Found"
            })
        }
        req.user = user;
        next();
    } catch (error) {
        console.log("Auth Middleware: Error Verifying Token:", error.message);
        return res.status(401).json({
            success: false,
            message: "Unauthorized - Error Verifying Token"
        })
    }
}

const isAdmin = async (req, res, next) => {
    try {
        if (req.user && req.user.role === 'admin') {
            next();
        } else {
            return res.status(403).json({
                success: false,
                message: "Forbidden - Admin Access Required"
            });
        }
    } catch (_error) {
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
}

module.exports = { protectedRoute, isAdmin };
