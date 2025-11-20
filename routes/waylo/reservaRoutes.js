const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const { crearReserva, reservasDeGuia, reservasDeCliente, actualizarEstado, aceptarReserva, pagarReserva } = require('../../controllers/waylo/reservaController');

router.post('/', requireAuth, crearReserva);
router.get('/guia/:id_perfil_guia', requireAuth, reservasDeGuia);
router.get('/cliente/:id_perfil_cliente', requireAuth, reservasDeCliente);
router.put('/:id_reserva/estado', requireAuth, actualizarEstado);
router.put('/:id_reserva/aceptar', requireAuth, aceptarReserva);
router.put('/:id_reserva/pagar', requireAuth, pagarReserva);

module.exports = router;
