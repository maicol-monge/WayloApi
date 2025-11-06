const express = require('express');
const router = express.Router();
const { crear, listarPorReserva, actualizarEstado } = require('../../controllers/waylo/reembolsoController');
const { requireAuth, requireAdmin } = require('../../middleware/authMiddleware');

router.post('/', requireAuth, crear);
router.get('/reserva/:id_reserva', requireAuth, listarPorReserva);
router.put('/:id/estado', requireAdmin, actualizarEstado);

module.exports = router;
