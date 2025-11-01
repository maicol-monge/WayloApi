const express = require('express');
const router = express.Router();
const { obtener, actualizar } = require('../../controllers/waylo/configController');

router.get('/:id_usuario', obtener);
router.put('/:id_usuario', actualizar);

module.exports = router;
