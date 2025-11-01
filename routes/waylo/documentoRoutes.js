const express = require('express');
const router = express.Router();
const { uploadMiddleware, subirDocumento } = require('../../controllers/waylo/documentoController');

router.post('/:id_perfil_guia', uploadMiddleware, subirDocumento);

module.exports = router;
