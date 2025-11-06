const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const { crearResena, resenasDeGuia, crearResenaCliente, resenasDeCliente } = require('../../controllers/waylo/resenaController');

router.post('/', requireAuth, crearResena);
router.post('/cliente', requireAuth, crearResenaCliente);
router.get('/guia/:id_perfil_guia', resenasDeGuia);
router.get('/cliente/:id_perfil_cliente', resenasDeCliente);

module.exports = router;
