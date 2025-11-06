const { db } = require('../../config/db');

// POST /api/waylo/resenas
async function crearResena(req, res) {
  try {
    const { id_reserva, id_perfil_cliente, id_perfil_guia, calificacion, comentario } = req.body;
    if (!id_perfil_cliente || !id_perfil_guia || !calificacion) {
      return res.status(400).json({ success: false, message: 'id_perfil_cliente, id_perfil_guia y calificacion requeridos' });
    }

    // validar que el cliente tenga una reserva completada con el guía
    const v = await db.query(
      `SELECT 1 FROM reservas WHERE id_perfil_cliente=$1 AND id_perfil_guia=$2 AND estado_reserva='Completada' LIMIT 1`,
      [id_perfil_cliente, id_perfil_guia]
    );
    if (v.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Solo clientes con reserva completada pueden calificar al guía' });
    }

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

// POST /api/waylo/resenas/cliente
async function crearResenaCliente(req, res) {
  try {
    const { id_reserva, id_perfil_cliente, id_perfil_guia, calificacion, comentario } = req.body;
    if (!id_perfil_cliente || !id_perfil_guia || !calificacion) {
      return res.status(400).json({ success: false, message: 'id_perfil_cliente, id_perfil_guia y calificacion requeridos' });
    }
    // validar que exista reserva completada entre ambos
    const v = await db.query(
      `SELECT 1 FROM reservas WHERE id_perfil_cliente=$1 AND id_perfil_guia=$2 AND estado_reserva='Completada' LIMIT 1`,
      [id_perfil_cliente, id_perfil_guia]
    );
    if (v.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Solo guías con reserva completada pueden calificar al usuario' });
    }
    const ins = await db.query(
      `INSERT INTO resena (id_reserva, id_perfil_cliente, id_perfil_guia, calificacion, comentario) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [id_reserva || null, id_perfil_cliente, id_perfil_guia, calificacion, comentario || null]
    );
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][resena] crear cliente error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/resenas/cliente/:id_perfil_cliente
async function resenasDeCliente(req, res) {
  try {
    const { id_perfil_cliente } = req.params;
    const q = await db.query('SELECT * FROM resena WHERE id_perfil_cliente=$1 ORDER BY created_at DESC', [id_perfil_cliente]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][resena] listar cliente error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { crearResena, resenasDeGuia, crearResenaCliente, resenasDeCliente };
