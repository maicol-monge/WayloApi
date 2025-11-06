const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const { obtenerCliente, obtenerClientePorUsuario, actualizarCliente } = require('../../controllers/waylo/perfilClienteController');

router.get('/:id', requireAuth, obtenerCliente);
router.get('/usuario/:id_usuario', requireAuth, obtenerClientePorUsuario);
router.put('/:id', requireAuth, actualizarCliente);

module.exports = router;
