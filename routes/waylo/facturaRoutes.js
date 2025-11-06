const express = require('express');
const router = express.Router();
const { crear, getByTransaccion, listarPorGuia, listarPorCliente } = require('../../controllers/waylo/facturaController');
const { requireAuth, requireAdmin } = require('../../middleware/authMiddleware');

router.post('/', requireAdmin, crear);
router.get('/transaccion/:id_transaccion', requireAuth, getByTransaccion);
router.get('/guia/:id_perfil_guia', requireAuth, listarPorGuia);
router.get('/cliente/:id_perfil_cliente', requireAuth, listarPorCliente);

module.exports = router;
