const express = require('express');
const router = express.Router();
const { uploadSingle, uploadFoto, uploadFotoPerfil, agregarFotoGuia } = require('../../controllers/waylo/mediaController');

router.post('/upload/foto', uploadSingle, uploadFoto);
router.post('/upload/foto-perfil', uploadSingle, uploadFotoPerfil);
router.post('/guias/:id_perfil_guia/fotos', uploadSingle, agregarFotoGuia);

module.exports = router;
