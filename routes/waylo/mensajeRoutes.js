const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const { enviarMensaje, listarMensajes } = require('../../controllers/waylo/mensajeController');

router.post('/', requireAuth, enviarMensaje);
router.get('/:id_conversacion', requireAuth, listarMensajes);

module.exports = router;
