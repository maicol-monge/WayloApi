const { db } = require('../../config/db');

// GET /api/waylo/notificaciones/:id_usuario
async function listar(req, res) {
  try {
    const { id_usuario } = req.params;
    const q = await db.query('SELECT * FROM notificacion WHERE id_usuario=$1 ORDER BY created_at DESC', [id_usuario]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][notif] listar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/notificaciones
async function crear(req, res) {
  try {
    const { id_usuario, tipo = 'otros', titulo, mensaje } = req.body;
    if (!id_usuario || !titulo) return res.status(400).json({ success: false, message: 'id_usuario y titulo requeridos' });
    const ins = await db.query('INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje) VALUES ($1,$2,$3,$4) RETURNING *', [id_usuario, tipo, titulo, mensaje || null]);
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][notif] crear error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/notificaciones/:id_notificacion/read
async function marcarLeida(req, res) {
  try {
    const { id_notificacion } = req.params;
    const up = await db.query("UPDATE notificacion SET is_read='S' WHERE id_notificacion=$1 RETURNING *", [id_notificacion]);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[waylo][notif] marcarLeida error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listar, crear, marcarLeida };
