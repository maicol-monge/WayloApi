const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const multer = require('multer');
const upload = multer();
const { obtenerCliente, obtenerClientePorUsuario, actualizarCliente, actualizarNombre, actualizarAvatar } = require('../../controllers/waylo/perfilClienteController');

router.get('/:id', requireAuth, obtenerCliente);
router.get('/usuario/:id_usuario', requireAuth, obtenerClientePorUsuario);
router.put('/:id', requireAuth, actualizarCliente);
router.put('/:id/nombre', requireAuth, actualizarNombre);
router.post('/:id/avatar', requireAuth, upload.single('file'), actualizarAvatar);

module.exports = router;
