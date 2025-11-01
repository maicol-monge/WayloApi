const express = require('express');
const router = express.Router();
const { listarGuias, obtenerGuia, actualizarGuia } = require('../../controllers/waylo/perfilGuiaController');

router.get('/', listarGuias);
router.get('/:id', obtenerGuia);
router.put('/:id', actualizarGuia);

module.exports = router;
