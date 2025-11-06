const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const { crearConversacion, listarConversaciones } = require('../../controllers/waylo/conversacionController');

router.post('/', requireAuth, crearConversacion);
router.get('/:id_usuario', requireAuth, listarConversaciones);

module.exports = router;
