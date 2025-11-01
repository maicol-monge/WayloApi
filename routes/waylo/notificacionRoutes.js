const express = require('express');
const router = express.Router();
const { listar, crear, marcarLeida } = require('../../controllers/waylo/notificacionController');

router.get('/:id_usuario', listar);
router.post('/', crear);
router.put('/:id_notificacion/read', marcarLeida);

module.exports = router;
