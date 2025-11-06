const { db } = require('../../config/db');

// POST /api/waylo/respuestas
async function crear(req, res) {
  try {
    const { id_resena, id_usuario, comentario } = req.body;
    if (!id_resena || !id_usuario || !comentario) return res.status(400).json({ success: false, message: 'id_resena, id_usuario y comentario requeridos' });
    const ins = await db.query('INSERT INTO respuesta_resena (id_resena, id_usuario, comentario) VALUES ($1,$2,$3) RETURNING *', [id_resena, id_usuario, comentario]);
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][respuesta_resena] crear error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/respuestas/resena/:id_resena
async function listarPorResena(req, res) {
  try {
    const { id_resena } = req.params;
    const q = await db.query('SELECT * FROM respuesta_resena WHERE id_resena=$1 ORDER BY created_at DESC', [id_resena]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][respuesta_resena] listar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { crear, listarPorResena };
