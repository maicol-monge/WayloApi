const { db } = require('../../config/db');

// GET /api/waylo/config/:id_usuario
async function obtener(req, res) {
  try {
    const { id_usuario } = req.params;
    const q = await db.query('SELECT * FROM configuracion WHERE id_usuario=$1', [id_usuario]);
    if (q.rows.length === 0) {
      const ins = await db.query("INSERT INTO configuracion (id_usuario) VALUES ($1) RETURNING *", [id_usuario]);
      return res.json({ success: true, data: ins.rows[0] });
    }
    res.json({ success: true, data: q.rows[0] });
  } catch (err) {
    console.error('[waylo][config] obtener error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/config/:id_usuario
async function actualizar(req, res) {
  try {
    const { id_usuario } = req.params;
    const { idioma_aplicacion, permitir_notificaciones, zona_horaria } = req.body;
    const q = await db.query(
      `UPDATE configuracion SET 
        idioma_aplicacion = COALESCE($1, idioma_aplicacion),
        permitir_notificaciones = COALESCE($2, permitir_notificaciones),
        zona_horaria = COALESCE($3, zona_horaria),
        updated_at = NOW()
      WHERE id_usuario=$4 RETURNING *`,
      [idioma_aplicacion || null, permitir_notificaciones || null, zona_horaria || null, id_usuario]
    );
    if (q.rows.length === 0) return res.status(404).json({ success: false, message: 'Configuración no encontrada' });
    res.json({ success: true, data: q.rows[0] });
  } catch (err) {
    console.error('[waylo][config] actualizar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { obtener, actualizar };
