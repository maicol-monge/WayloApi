const express = require('express');
const router = express.Router();
const { listar, crear, eliminar, listarRecurrente, guardarRecurrente, actualizarRecurrente } = require('../../controllers/waylo/disponibilidadController');

router.get('/:id_perfil_guia', listar);
router.post('/:id_perfil_guia', crear);
router.delete('/item/:id_rango_disponible', eliminar);
// Recurring
router.get('/recurrente/:id_perfil_guia', listarRecurrente);
router.post('/recurrente/:id_perfil_guia', guardarRecurrente);
router.put('/recurrente/:id_perfil_guia/:weekday', actualizarRecurrente);

module.exports = router;
