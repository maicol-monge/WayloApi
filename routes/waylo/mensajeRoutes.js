const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const { enviarMensaje, listarMensajes, marcarMensajesLeidos } = require('../../controllers/waylo/mensajeController');

router.post('/', requireAuth, enviarMensaje);
router.get('/:id_conversacion', requireAuth, listarMensajes);
router.patch('/:id_conversacion/mark-read', requireAuth, marcarMensajesLeidos);

module.exports = router;
