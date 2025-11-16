const express = require('express');
const router = express.Router();
const { requireAuth } = require('../../middleware/authMiddleware');
const multer = require('multer');
const upload = multer();
const { listarGuias, obtenerGuia, actualizarGuia, actualizarGuiaAvatar, agregarIdioma, actualizarIdioma, eliminarIdioma, subirFotoGuia, eliminarFotoGuia } = require('../../controllers/waylo/perfilGuiaController');

router.get('/', listarGuias);
router.get('/:id', obtenerGuia);
router.put('/:id', requireAuth, actualizarGuia);
router.post('/:id/avatar', requireAuth, upload.single('file'), actualizarGuiaAvatar);
// Idiomas CRUD
router.post('/:id/idiomas', requireAuth, agregarIdioma);
router.put('/:id/idiomas/:id_idioma', requireAuth, actualizarIdioma);
router.delete('/:id/idiomas/:id_idioma', requireAuth, eliminarIdioma);
// Fotos galería
router.post('/:id/fotos', requireAuth, upload.single('file'), subirFotoGuia);
router.delete('/:id/fotos/:id_foto_guia', requireAuth, eliminarFotoGuia);

module.exports = router;
