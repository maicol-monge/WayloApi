const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const { obtenerCliente, actualizarCliente } = require('../../controllers/waylo/perfilClienteController');

router.get('/:id', requireAuth, obtenerCliente);
router.put('/:id', requireAuth, actualizarCliente);

module.exports = router;
