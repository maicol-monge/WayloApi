const express = require('express');
const router = express.Router();
const { enviarMensaje, listarMensajes } = require('../../controllers/waylo/mensajeController');

router.post('/', enviarMensaje);
router.get('/:id_conversacion', listarMensajes);

module.exports = router;
