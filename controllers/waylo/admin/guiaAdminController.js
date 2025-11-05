const { db } = require('../../../config/db');

// GET /api/waylo/admin/guias
async function listGuias(req, res) {
  try {
    const { verificacion_estado, q, page = 1, pageSize = 50 } = req.query;
    const params = [];
    const where = [];
    let idx = 1;
    if (verificacion_estado) { where.push(`pg.verificacion_estado=$${idx++}`); params.push(verificacion_estado); }
    if (q) { where.push(`(LOWER(u.nombre) LIKE LOWER($${idx++}) OR LOWER(pg.descripcion) LIKE LOWER($${idx++}))`); params.push(`%${q}%`, `%${q}%`); idx++; }
    const offset = (Number(page)-1) * Number(pageSize);
    const sql = `SELECT pg.*, u.nombre as nombre_usuario FROM perfil_guia pg JOIN usuario u ON u.id_usuario = pg.id_usuario
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY pg.created_at DESC LIMIT ${Number(pageSize)} OFFSET ${offset}`;
    const qres = await db.query(sql, params);
    res.json({ success: true, data: qres.rows });
  } catch (err) {
    console.error('[admin][guias] list error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/admin/guias/:id
async function getGuia(req, res) {
  try {
    const { id } = req.params;
    const q = await db.query('SELECT pg.*, u.nombre, u.email FROM perfil_guia pg JOIN usuario u ON u.id_usuario = pg.id_usuario WHERE pg.id_perfil_guia=$1', [id]);
    if (q.rows.length === 0) return res.status(404).json({ success: false, message: 'Guía no encontrada' });
    const docs = await db.query('SELECT * FROM documentos_guia WHERE id_perfil_guia=$1 ORDER BY id_documento_guia DESC', [id]);
    const fotos = await db.query('SELECT * FROM fotos_guia WHERE id_perfil_guia=$1 ORDER BY created_at DESC', [id]);
    res.json({ success: true, data: { perfil: q.rows[0], documentos: docs.rows, fotos: fotos.rows } });
  } catch (err) {
    console.error('[admin][guias] get error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/admin/guias/:id/verify
async function setVerification(req, res) {
  try {
    const { id } = req.params; // id_perfil_guia
    const { verificacion_estado, reviewed_by } = req.body; // 'aprobado'|'rechazado'|'pendiente'
    if (!verificacion_estado) return res.status(400).json({ success: false, message: 'verificacion_estado requerido' });
    const up = await db.query('UPDATE perfil_guia SET verificacion_estado=$1, updated_at=NOW() WHERE id_perfil_guia=$2 RETURNING *', [verificacion_estado, id]);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Perfil guía no encontrado' });
    // Optionally update pending documents to approved when approving
    if (verificacion_estado === 'aprobado') {
      await db.query("UPDATE documentos_guia SET estado='aprobado', reviewed_by=$1, reviewed_at=NOW() WHERE id_perfil_guia=$2 AND estado='pendiente'", [reviewed_by || null, id]);
    }
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[admin][guias] setVerification error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// GET /api/waylo/admin/documentos?estado=pendiente
async function listDocumentos(req, res) {
  try {
    const { estado = 'pendiente', page = 1, pageSize = 50 } = req.query;
    const offset = (Number(page)-1)*Number(pageSize);
    const q = await db.query('SELECT d.*, pg.id_perfil_guia, u.nombre as guia_nombre FROM documentos_guia d JOIN perfil_guia pg ON pg.id_perfil_guia=d.id_perfil_guia JOIN usuario u ON u.id_usuario=pg.id_usuario WHERE d.estado=$1 ORDER BY d.created_at DESC LIMIT $2 OFFSET $3', [estado, Number(pageSize), offset]);
    res.json({ success: true, data: q.rows });
  } catch (err) {
    console.error('[admin][documentos] list error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// PUT /api/waylo/admin/documentos/:id_documento/estado
async function setDocumentoEstado(req, res) {
  try {
    const { id_documento } = req.params;
    const { estado, reviewed_by } = req.body; // 'aprobado'|'rechazado'
    if (!estado) return res.status(400).json({ success: false, message: 'estado requerido' });
    const up = await db.query('UPDATE documentos_guia SET estado=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id_documento_guia=$3 RETURNING *', [estado, reviewed_by || null, id_documento]);
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Documento no encontrado' });
    res.json({ success: true, data: up.rows[0] });
  } catch (err) {
    console.error('[admin][documentos] setEstado error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listGuias, getGuia, setVerification, listDocumentos, setDocumentoEstado };
