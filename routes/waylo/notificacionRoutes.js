const express = require('express');
const router = express.Router();
const { requireAuth, ensureSameUserParam } = require('../../middleware/authMiddleware');
const { listar, crear, marcarLeida } = require('../../controllers/waylo/notificacionController');

router.get('/:id_usuario', requireAuth, ensureSameUserParam('id_usuario'), listar);
router.post('/', requireAuth, crear);
router.put('/:id_notificacion/read', requireAuth, marcarLeida);

module.exports = router;
