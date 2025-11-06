const express = require('express');
const router = express.Router();
const { crear, listarPorResena } = require('../../controllers/waylo/respuestaResenaController');
const { requireAuth } = require('../../middleware/authMiddleware');

router.post('/', requireAuth, crear);
router.get('/resena/:id_resena', listarPorResena);

module.exports = router;
