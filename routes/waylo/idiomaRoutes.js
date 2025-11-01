const express = require('express');
const router = express.Router();
const { listarIdiomas, agregarIdioma, eliminarIdioma } = require('../../controllers/waylo/idiomaController');

router.get('/:id_usuario', listarIdiomas);
router.post('/:id_usuario', agregarIdioma);
router.delete('/item/:id_idioma', eliminarIdioma);

module.exports = router;
