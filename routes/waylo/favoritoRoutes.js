const express = require('express');
const router = express.Router();
const { agregar, eliminar, listarPorCliente } = require('../../controllers/waylo/favoritoController');

router.post('/', agregar);
router.delete('/', eliminar);
router.get('/cliente/:id_perfil_cliente', listarPorCliente);

module.exports = router;
