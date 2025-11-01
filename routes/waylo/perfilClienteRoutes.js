const express = require('express');
const router = express.Router();
const { obtenerCliente, actualizarCliente } = require('../../controllers/waylo/perfilClienteController');

router.get('/:id', obtenerCliente);
router.put('/:id', actualizarCliente);

module.exports = router;
