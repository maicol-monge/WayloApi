const express = require('express');
const router = express.Router();
const { listar, crear, eliminar } = require('../../controllers/waylo/disponibilidadController');

router.get('/:id_perfil_guia', listar);
router.post('/:id_perfil_guia', crear);
router.delete('/item/:id_rango_disponible', eliminar);

module.exports = router;
