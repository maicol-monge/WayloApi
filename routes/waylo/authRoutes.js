const express = require('express');
const router = express.Router();
const { registrarCliente, registrarGuia, login } = require('../../controllers/waylo/authController');

router.post('/registro/cliente', registrarCliente);
router.post('/registro/guia', registrarGuia);
router.post('/login', login);

module.exports = router;
