const express = require('express');
const router = express.Router();
const { crearConversacion, listarConversaciones } = require('../../controllers/waylo/conversacionController');

router.post('/', crearConversacion);
router.get('/:id_usuario', listarConversaciones);

module.exports = router;
