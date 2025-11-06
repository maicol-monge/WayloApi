const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const { uploadSingle, uploadFoto, uploadFotoPerfil, agregarFotoGuia } = require('../../controllers/waylo/mediaController');

router.post('/upload/foto', requireAuth, uploadSingle, uploadFoto);
router.post('/upload/foto-perfil', requireAuth, uploadSingle, uploadFotoPerfil);
router.post('/guias/:id_perfil_guia/fotos', requireAuth, uploadSingle, agregarFotoGuia);

module.exports = router;
