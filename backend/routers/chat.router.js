const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { protectedRoute } = require('../middlewares/auth.middleware');

// Chat (Gemini API) je plačljiv vir — prejšnje stanje: popolnoma javen (znevarnost zlorabe/billinga)
router.use(protectedRoute);

router.post('/message', chatController.sendMessage);

module.exports = router;
