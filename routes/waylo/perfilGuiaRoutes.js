const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const { listarGuias, obtenerGuia, actualizarGuia } = require('../../controllers/waylo/perfilGuiaController');

router.get('/', listarGuias);
router.get('/:id', obtenerGuia);
router.put('/:id', requireAuth, actualizarGuia);

module.exports = router;
