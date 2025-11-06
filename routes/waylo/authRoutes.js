const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // memoryStorage por defecto
const { registrarCliente, registrarGuia, login, refreshToken, logout } = require('../../controllers/waylo/authController');
const { forgotPassword, resetPassword } = require('../../controllers/waylo/passwordResetController');
const { requireAuth } = require('../../middleware/authMiddleware');

// permitir multipart/form-data con campo 'file' para imagen_perfil opcional
router.post('/registro/cliente', upload.single('file'), registrarCliente);
router.post('/registro/guia', upload.single('file'), registrarGuia);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', requireAuth, logout);
router.post('/password/forgot', forgotPassword);
router.post('/password/reset', resetPassword);

module.exports = router;
