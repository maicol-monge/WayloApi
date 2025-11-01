const { db } = require('../../config/db');

// POST /api/waylo/mensajes
async function enviarMensaje(req, res) {
  try {
    const { id_conversacion, id_usuario_sender, mensaje, media_url } = req.body;
    if (!id_conversacion || !id_usuario_sender || (!mensaje && !media_url)) {
      return res.status(400).json({ success: false, message: 'id_conversacion, id_usuario_sender y mensaje o media_url requeridos' });
    }
    const ins = await db.query('INSERT INTO mensaje (id_conversacion, id_usuario_sender, mensaje, media_url) VALUES ($1,$2,$3,$4) RETURNING *', [id_conversacion, id_usuario_sender, mensaje || null, media_url || null]);
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][chat] enviar mensaje error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/mensajes/:id_conversacion
async function listarMensajes(req, res) {
  try {
    const { id_conversacion } = req.params;
    const q = await db.query('SELECT * FROM mensaje WHERE id_conversacion=$1 ORDER BY created_at ASC', [id_conversacion]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][chat] listar mensajes error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { enviarMensaje, listarMensajes };
