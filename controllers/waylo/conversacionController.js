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
    // Extendemos la consulta para incluir último mensaje, conteo de "no leídos" y datos del otro usuario
    const q = await db.query(`
      SELECT 
        c.*,
        lm.mensaje AS last_message,
        lm.created_at AS last_message_created_at,
        COALESCE(uc.unread_count, 0) AS unread_count,
        -- Datos del otro usuario (el que NO es id_usuario)
        u.nombre AS counterpart_nombre,
        u.email AS counterpart_email,
        CASE 
          WHEN pg.id_perfil_guia IS NOT NULL THEN pg.imagen_perfil
          WHEN pc.id_perfil_cliente IS NOT NULL THEN pc.imagen_perfil
          ELSE NULL
        END AS counterpart_avatar
      FROM conversacion c
      LEFT JOIN LATERAL (
        SELECT mensaje, created_at
        FROM mensaje m
        WHERE m.id_conversacion = c.id_conversacion
        ORDER BY created_at DESC
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS unread_count
        FROM mensaje m2
        WHERE m2.id_conversacion = c.id_conversacion AND m2.id_usuario_sender <> $1 AND id_read='N'
      ) uc ON TRUE
      -- Join con el otro usuario
      LEFT JOIN usuario u ON (
        CASE 
          WHEN c.id_usuario1 = $1 THEN u.id_usuario = c.id_usuario2
          ELSE u.id_usuario = c.id_usuario1
        END
      )
      -- Intentar obtener avatar del perfil de guía
      LEFT JOIN perfil_guia pg ON pg.id_usuario = u.id_usuario
      -- O del perfil de cliente
      LEFT JOIN perfil_cliente pc ON pc.id_usuario = u.id_usuario
      WHERE c.id_usuario1=$1 OR c.id_usuario2=$1
      ORDER BY COALESCE(lm.created_at, c.created_at) DESC
    `, [id_usuario]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[waylo][chat] listar conversacion error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { crearConversacion, listarConversaciones };
