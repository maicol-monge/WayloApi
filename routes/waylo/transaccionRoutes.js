const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const { crearTransaccion, listarPorUsuario, listarPorGuia } = require('../../controllers/waylo/transaccionController');

router.post('/', requireAuth, crearTransaccion);
router.get('/usuario/:id_usuario', requireAuth, listarPorUsuario);
router.get('/guia/:id_perfil_guia', requireAuth, listarPorGuia);

module.exports = router;
