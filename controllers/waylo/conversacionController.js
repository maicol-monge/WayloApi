const { db } = require('../../config/db');

// POST /api/waylo/conversaciones
async function crearConversacion(req, res) {
  try {
    const { id_usuario1, id_usuario2 } = req.body;
    if (!id_usuario1 || !id_usuario2) return res.status(400).json({ success: false, message: 'id_usuario1 y id_usuario2 requeridos' });

    // Verificar si ya existe
    const ex = await db.query('SELECT * FROM conversacion WHERE (id_usuario1=$1 AND id_usuario2=$2) OR (id_usuario1=$2 AND id_usuario2=$1)', [id_usuario1, id_usuario2]);
    if (ex.rows.length > 0) return res.json({ success: true, data: ex.rows[0] });

    const ins = await db.query('INSERT INTO conversacion (id_usuario1, id_usuario2) VALUES ($1,$2) RETURNING *', [id_usuario1, id_usuario2]);
    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][chat] crear conversacion error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/conversaciones/:id_usuario
async function listarConversaciones(req, res) {
  try {
    const { id_usuario } = req.params;
    const q = await db.query('SELECT * FROM conversacion WHERE id_usuario1=$1 OR id_usuario2=$1 ORDER BY created_at DESC', [id_usuario]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][chat] listar conversacion error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { crearConversacion, listarConversaciones };
