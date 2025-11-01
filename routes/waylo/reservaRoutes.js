const express = require('express');
const router = express.Router();
const { crearReserva, reservasDeGuia, reservasDeCliente, actualizarEstado } = require('../../controllers/waylo/reservaController');

router.post('/', crearReserva);
router.get('/guia/:id_perfil_guia', reservasDeGuia);
router.get('/cliente/:id_perfil_cliente', reservasDeCliente);
router.put('/:id_reserva/estado', actualizarEstado);

module.exports = router;
