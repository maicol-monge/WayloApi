const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const multer = require('multer');
const upload = multer();
const { listarGuias, obtenerGuia, actualizarGuia, actualizarGuiaAvatar } = require('../../controllers/waylo/perfilGuiaController');

router.get('/', listarGuias);
router.get('/:id', obtenerGuia);
router.put('/:id', requireAuth, actualizarGuia);
router.post('/:id/avatar', requireAuth, upload.single('file'), actualizarGuiaAvatar);

module.exports = router;
