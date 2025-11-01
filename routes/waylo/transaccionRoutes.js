const express = require('express');
const router = express.Router();
const { crearTransaccion } = require('../../controllers/waylo/transaccionController');

router.post('/', crearTransaccion);

module.exports = router;
