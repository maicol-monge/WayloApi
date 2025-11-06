const express = require('express');
const router = express.Router();
const { listar, obtener, crear, actualizar, eliminar } = require('../../controllers/waylo/politicaController');
const { requireAuth, requireAdmin } = require('../../middleware/authMiddleware');

router.get('/', listar);
router.get('/:id', obtener);
router.post('/', requireAdmin, crear);
router.put('/:id', requireAdmin, actualizar);
router.delete('/:id', requireAdmin, eliminar);

module.exports = router;
