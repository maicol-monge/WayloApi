const { db } = require('../../config/db');
const { obtenerUrlPublica, subirImagen } = require('../../services/imageService');

// GET /api/waylo/guias
async function listarGuias(req, res) {
  try {
    const { ciudad, idioma, precio_min, precio_max, rating_min, q, page = 1, pageSize = 20 } = req.query;
  const where = ["pg.estado='A'", "COALESCE(pg.verificacion_estado,'pendiente') = 'aprobado'"];
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
    // Firmar URL de imagen_perfil si existe (bucket privado)
    const rows = await Promise.all(qres.rows.map(async (row) => {
      if (row.imagen_perfil) {
        try {
          const signed = await obtenerUrlPublica(row.imagen_perfil, 3600);
          if (signed.success) row.imagen_perfil_url = signed.signedUrl;
        } catch (e) {}
      }
      return row;
    }));
    res.json({ success: true, data: rows });
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
    // firmar imagen de perfil
    if (q.rows[0].imagen_perfil) {
      try {
        const signed = await obtenerUrlPublica(q.rows[0].imagen_perfil, 3600);
        if (signed.success) q.rows[0].imagen_perfil_url = signed.signedUrl;
      } catch (e) {}
    }
    // fotos
    const fotos = await db.query(`SELECT id_foto_guia, foto_url, descripcion, aprobado FROM fotos_guia WHERE id_perfil_guia=$1 AND estado='A' ORDER BY created_at DESC`, [id]);
    // firmar fotos
    const fotosRows = await Promise.all(fotos.rows.map(async (f) => {
      if (f.foto_url) {
        try {
          const signed = await obtenerUrlPublica(f.foto_url, 3600);
          if (signed.success) f.foto_url_signed = signed.signedUrl;
        } catch (e) {}
      }
      return f;
    }));
    // resenas
    const resenas = await db.query(`SELECT r.*, pc.id_perfil_cliente FROM resena r LEFT JOIN perfil_cliente pc ON pc.id_perfil_cliente = r.id_perfil_cliente WHERE r.id_perfil_guia=$1 ORDER BY created_at DESC`, [id]);
    // idiomas del guía (por id_usuario)
    const id_usuario = q.rows[0].id_usuario;
    const idiomas = await db.query('SELECT id_idioma, nombre, nivel FROM idiomas WHERE id_usuario=$1 ORDER BY id_idioma', [id_usuario]);

  res.json({ success: true, data: { perfil: q.rows[0], fotos: fotosRows, resenas: resenas.rows, idiomas: idiomas.rows } });
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

// POST /api/waylo/guias/:id/avatar (multipart) -> actualiza imagen_perfil
async function actualizarGuiaAvatar(req, res) {
  try {
    const { id } = req.params;
    // validar perfil existe y pertenece a usuario autenticado (opcional)
    const perfilQ = await db.query('SELECT id_perfil_guia, id_usuario, imagen_perfil FROM perfil_guia WHERE id_perfil_guia=$1 LIMIT 1', [id]);
    if (perfilQ.rows.length === 0) return res.status(404).json({ success: false, message: 'Perfil guía no encontrado' });
    // opcional: comprobar ownership
    if (req.user && perfilQ.rows[0].id_usuario !== req.user.id_usuario) {
      return res.status(403).json({ success: false, message: 'No autorizado' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Archivo requerido' });
    const lower = (req.file.originalname || '').toLowerCase();
    if (!/\.(jpg|jpeg|png|webp)$/i.test(lower)) {
      return res.status(400).json({ success: false, message: 'Formato de imagen inválido' });
    }
    // subir nueva imagen
    const upRes = await subirImagen(req.file.buffer, req.file.originalname, 'foto-perfil');
    if (!upRes.success) return res.status(500).json({ success: false, message: 'Error subiendo imagen' });
    const path = upRes.data.path;
  // Nota: la tabla perfil_guia no tiene columna updated_at; solo actualizamos imagen_perfil
  const updated = await db.query('UPDATE perfil_guia SET imagen_perfil=$1 WHERE id_perfil_guia=$2 RETURNING *', [path, id]);
    const perfil = updated.rows[0];
    let imagen_perfil_url = null;
    if (perfil.imagen_perfil) {
      try {
        const signed = await obtenerUrlPublica(perfil.imagen_perfil, 3600);
        if (signed.success) imagen_perfil_url = signed.signedUrl;
      } catch (e) {}
    }
    return res.json({ success: true, data: { ...perfil, imagen_perfil_url } });
  } catch (err) {
    console.error('[waylo][guias] avatar error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listarGuias, obtenerGuia, actualizarGuia, actualizarGuiaAvatar };
