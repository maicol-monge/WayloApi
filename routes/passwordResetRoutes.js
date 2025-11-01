const express = require("express");
const router = express.Router();
const { solicitarReset, validarToken, confirmarReset } = require("../controllers/passwordResetController");
const { sendPasswordResetEmail } = require("../services/emailService");

// POST /api/password/solicitar - Solicitar restablecimiento (tipo: 'usuario'|'tienda', correo)
router.post("/solicitar", solicitarReset);

// GET /api/password/validar/:token - Validar token desde el frontend (React en Render)
router.get("/validar/:token", validarToken);

// POST /api/password/confirmar/:token - Confirmar restablecimiento con nueva contraseña
router.post("/confirmar/:token", confirmarReset);

// POST /api/password/test-send - Probar envío directo (solo para debugging)
// Body: { to, tipo }
router.post('/test-send', async (req, res) => {
	try {
		const { to, tipo = 'usuario' } = req.body;
		if (!to) return res.status(400).json({ success: false, message: 'to es requerido' });

		const base = process.env.FRONTEND_BASE_URL || 'http://localhost:5173';
		const fakeToken = 'TEST-' + Math.random().toString(36).slice(2, 10);
		const enlace = `${base.replace(/\/$/, '')}/reset?token=${encodeURIComponent(fakeToken)}&tipo=${encodeURIComponent(tipo)}`;

		// Forzar DEBUG_EMAIL si se solicita
		try {
			await sendPasswordResetEmail({ to, link: enlace, tipo, displayName: tipo });
			return res.json({ success: true, message: 'Intento de envío realizado (revisa logs)'});
		} catch (err) {
			console.error('[test-send] error:', err);
			return res.status(500).json({ success: false, message: 'Error en intento de envío', error: String(err) });
		}
	} catch (error) {
		console.error('test-send error:', error);
		res.status(500).json({ success: false, message: 'Error interno' });
	}
});

module.exports = router;
