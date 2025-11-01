const { db } = require('../../config/db');

// GET /api/waylo/disponibilidad/:id_perfil_guia
async function listar(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const q = await db.query('SELECT * FROM rango_disponible WHERE id_perfil_guia=$1 AND estado=\'A\' ORDER BY hora_inicio', [id_perfil_guia]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][disponibilidad] listar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/disponibilidad/:id_perfil_guia
async function crear(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const { hora_inicio, hora_fin } = req.body;
    if (!hora_inicio || !hora_fin) return res.status(400).json({ success: false, message: 'hora_inicio y hora_fin requeridos' });
    const ins = await db.query('INSERT INTO rango_disponible (id_perfil_guia, hora_inicio, hora_fin) VALUES ($1,$2,$3) RETURNING *', [id_perfil_guia, hora_inicio, hora_fin]);
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][disponibilidad] crear error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// DELETE /api/waylo/disponibilidad/item/:id_rango_disponible
async function eliminar(req, res) {
  try {
    const { id_rango_disponible } = req.params;
    await db.query("UPDATE rango_disponible SET estado='I' WHERE id_rango_disponible=$1", [id_rango_disponible]);
    res.json({ success: true });
  } catch (err) {
    console.error('[waylo][disponibilidad] eliminar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listar, crear, eliminar };
