const express = require('express');
const router = express.Router();
const { crearResena, resenasDeGuia } = require('../../controllers/waylo/resenaController');

router.post('/', crearResena);
router.get('/guia/:id_perfil_guia', resenasDeGuia);

module.exports = router;
