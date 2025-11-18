const express = require('express');
const router = express.Router();
const { homeGuia } = require('../../controllers/waylo/homeGuiaController');
const { homeCliente } = require('../../controllers/waylo/homeClienteController');
const { requireAuth } = require('../../middleware/authMiddleware');

// Agregamos autenticación para proteger datos del guía.
router.get('/guia/:id_perfil_guia', requireAuth, homeGuia);
router.get('/cliente/:id_perfil_cliente', requireAuth, homeCliente);

module.exports = router;