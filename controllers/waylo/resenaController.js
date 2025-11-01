const { db } = require('../../config/db');

// POST /api/waylo/resenas
async function crearResena(req, res) {
  try {
    const { id_reserva, id_perfil_cliente, id_perfil_guia, calificacion, comentario } = req.body;
    if (!id_perfil_cliente || !id_perfil_guia || !calificacion) {
      return res.status(400).json({ success: false, message: 'id_perfil_cliente, id_perfil_guia y calificacion requeridos' });
    }

    // TODO: validar que el cliente tenga una reserva completada con el guía

    const ins = await db.query(
      `INSERT INTO resena (id_reserva, id_perfil_cliente, id_perfil_guia, calificacion, comentario) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id_reserva || null, id_perfil_cliente, id_perfil_guia, calificacion, comentario || null]
    );

    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][resena] crear error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/resenas/guia/:id_perfil_guia
async function resenasDeGuia(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const q = await db.query('SELECT * FROM resena WHERE id_perfil_guia=$1 ORDER BY created_at DESC', [id_perfil_guia]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][resena] listar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { crearResena, resenasDeGuia };
