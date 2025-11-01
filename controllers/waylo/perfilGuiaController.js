const { db } = require('../../config/db');

// GET /api/waylo/guias
async function listarGuias(req, res) {
  try {
    const { ciudad, idioma, precio_min, precio_max, rating_min, q, page = 1, pageSize = 20 } = req.query;
    const where = ["pg.estado='A'"];
    const params = [];
    let idx = 1;

    if (ciudad) { where.push(`LOWER(pg.ciudad)=LOWER($${idx++})`); params.push(ciudad); }
    if (precio_min) { where.push(`pg.precio_hora >= $${idx++}`); params.push(Number(precio_min)); }
    if (precio_max) { where.push(`pg.precio_hora <= $${idx++}`); params.push(Number(precio_max)); }
    if (q) { where.push(`(LOWER(u.nombre) LIKE LOWER($${idx++}) OR LOWER(pg.descripcion) LIKE LOWER($${idx++}))`); params.push(`%${q}%`, `%${q}%`); idx++; }
    if (rating_min) { where.push(`COALESCE(avg_r,0) >= $${idx++}`); params.push(Number(rating_min)); }

    // idioma requiere join
    let idiomaJoin = '';
    if (idioma) {
      idiomaJoin = 'JOIN idiomas i ON i.id_usuario = u.id_usuario';
      where.push(`LOWER(i.nombre)=LOWER($${idx++})`);
      params.push(idioma);
    }

    const offset = (Number(page) - 1) * Number(pageSize);

    const sql = `
      WITH resenas AS (
        SELECT id_perfil_guia, AVG(calificacion) as avg_r, COUNT(*) as cnt
        FROM resena WHERE estado='A' GROUP BY id_perfil_guia
      )
      SELECT pg.*, u.nombre as nombre_guia, COALESCE(r.avg_r,0) as rating_promedio, COALESCE(r.cnt,0) as total_resenas
      FROM perfil_guia pg
      JOIN usuario u ON u.id_usuario = pg.id_usuario
      LEFT JOIN resenas r ON r.id_perfil_guia = pg.id_perfil_guia
      ${idiomaJoin}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY rating_promedio DESC NULLS LAST, pg.precio_hora ASC NULLS LAST
      LIMIT ${Number(pageSize)} OFFSET ${offset}
    `;

    const qres = await db.query(sql, params);
    res.json({ success: true, data: qres.rows });
  } catch (err) {
    console.error('[waylo][guias] listar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/guias/:id
async function obtenerGuia(req, res) {
  try {
    const { id } = req.params;
    const q = await db.query(`SELECT pg.*, u.nombre, u.email FROM perfil_guia pg JOIN usuario u ON u.id_usuario=pg.id_usuario WHERE pg.id_perfil_guia=$1`, [id]);
    if (q.rows.length === 0) return res.status(404).json({ success: false, message: 'Perfil guía no encontrado' });

    // fotos
    const fotos = await db.query(`SELECT id_foto_guia, foto_url, descripcion, aprobado FROM fotos_guia WHERE id_perfil_guia=$1 AND estado='A' ORDER BY created_at DESC`, [id]);
    // resenas
    const resenas = await db.query(`SELECT r.*, pc.id_perfil_cliente FROM resena r LEFT JOIN perfil_cliente pc ON pc.id_perfil_cliente = r.id_perfil_cliente WHERE r.id_perfil_guia=$1 ORDER BY created_at DESC`, [id]);

    res.json({ success: true, data: { perfil: q.rows[0], fotos: fotos.rows, resenas: resenas.rows } });
  } catch (err) {
    console.error('[waylo][guias] obtener error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/guias/:id
async function actualizarGuia(req, res) {
  try {
    const { id } = req.params;
    const { descripcion, pais, ciudad, anios_experiencia, precio_hora, precio_dia_personalizado } = req.body;

    const fields = [];
    const params = [];
    let idx = 1;

    if (descripcion !== undefined) { fields.push(`descripcion=$${idx++}`); params.push(descripcion); }
    if (pais !== undefined) { fields.push(`pais=$${idx++}`); params.push(pais); }
    if (ciudad !== undefined) { fields.push(`ciudad=$${idx++}`); params.push(ciudad); }
    if (anios_experiencia !== undefined) { fields.push(`anios_experiencia=$${idx++}`); params.push(anios_experiencia); }
    if (precio_hora !== undefined) { fields.push(`precio_hora=$${idx++}`); params.push(precio_hora); }
    if (precio_dia_personalizado !== undefined) { fields.push(`precio_dia_personalizado=$${idx++}`); params.push(precio_dia_personalizado); }

    if (!fields.length) return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
    params.push(id);

  const up = await db.query(`UPDATE perfil_guia SET ${fields.join(', ')} WHERE id_perfil_guia=$${idx} RETURNING *`, params);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Perfil guía no encontrado' });

    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[waylo][guias] actualizar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listarGuias, obtenerGuia, actualizarGuia };
