const { db } = require('../../../config/db');
const { sendPasswordResetEmail, sendPhotoDeletedEmail, sendGuideApprovedEmail, sendAccountDeactivatedEmail } = require('../../../services/emailService');
const { obtenerUrlPublica, eliminarImagen } = require('../../../services/imageService');

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
    const rows = await Promise.all(qres.rows.map(async (row) => {
      if (row.imagen_perfil) {
        try {
          const signed = await obtenerUrlPublica(row.imagen_perfil, 1800);
          if (signed.success) row.imagen_perfil_url = signed.signedUrl;
        } catch (e) {}
      }
      return row;
    }));
    res.json({ success: true, data: rows });
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
    if (q.rows[0].imagen_perfil) {
      try {
        const signed = await obtenerUrlPublica(q.rows[0].imagen_perfil, 1800);
        if (signed.success) q.rows[0].imagen_perfil_url = signed.signedUrl;
      } catch (e) {}
    }
  const docs = await db.query('SELECT * FROM documentos_guia WHERE id_perfil_guia=$1 ORDER BY id_documento_guia DESC', [id]);
    const fotos = await db.query('SELECT * FROM fotos_guia WHERE id_perfil_guia=$1 ORDER BY created_at DESC', [id]);
    const fotosRows = await Promise.all(fotos.rows.map(async (f) => {
      if (f.foto_url) {
        try {
          const signed = await obtenerUrlPublica(f.foto_url, 1800);
          if (signed.success) f.foto_url_signed = signed.signedUrl;
        } catch (e) {}
      }
      return f;
    }));
    // Firmar URLs de documentos (archivo_url) y normalizar nombres para el panel
    const documentosRows = await Promise.all((docs.rows || []).map(async (d) => {
      if (d.archivo_url) {
        try {
          const signed = await obtenerUrlPublica(d.archivo_url, 1800);
          if (signed.success) d.documento_url_signed = signed.signedUrl;
        } catch (e) {}
        d.documento_url = d.archivo_url;
        d.url = d.archivo_url;
      }
      if (!d.estado_documento && d.estado) d.estado_documento = d.estado;
      return d;
    }));

    // Idiomas del guía
    let idiomas = [];
    try {
      const idi = await db.query('SELECT id_idioma, nombre, nivel FROM idiomas WHERE id_usuario=$1 ORDER BY id_idioma', [q.rows[0].id_usuario]);
      idiomas = idi.rows;
    } catch (e) {
      idiomas = [];
    }

    res.json({ success: true, data: { perfil: q.rows[0], documentos: documentosRows, fotos: fotosRows, idiomas } });
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
    // Nota: la tabla perfil_guia no tiene columna updated_at en el schema actual, removerla evita error 500
    let up;
    try {
      up = await db.query('UPDATE perfil_guia SET verificacion_estado=$1 WHERE id_perfil_guia=$2 RETURNING *', [verificacion_estado, id]);
    } catch (dbErr) {
      console.error('[admin][guias] setVerification DB error:', dbErr.message);
      return res.status(500).json({ success: false, message: 'Error al actualizar verificación', detail: dbErr.message });
    }
    if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Perfil guía no encontrado' });
    
    // Optionally update pending documents to approved when approving
    if (verificacion_estado === 'aprobado') {
      try {
        await db.query("UPDATE documentos_guia SET estado='aprobado', reviewed_by=$1, reviewed_at=NOW() WHERE id_perfil_guia=$2 AND estado='pendiente'", [reviewed_by || null, id]);
      } catch (docErr) {
        console.error('[admin][guias] Error updating documents (may need to run migration):', docErr.message);
        // Non-blocking - continue even if document update fails
      }
    }
    // crear notificación al guía y enviar email si fue aprobado
    try {
      const u = await db.query('SELECT u.id_usuario, u.email, u.nombre FROM perfil_guia pg JOIN usuario u ON u.id_usuario=pg.id_usuario WHERE pg.id_perfil_guia=$1', [id]);
      if (u.rows.length) {
        await db.query('INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje) VALUES ($1,$2,$3,$4)', [u.rows[0].id_usuario, 'otros', 'Estado de verificación', `Tu verificación fue actualizada a: ${verificacion_estado}`]);
        
        // Enviar email si fue aprobado
        if (verificacion_estado === 'aprobado') {
          try {
            await sendGuideApprovedEmail({ to: u.rows[0].email, displayName: u.rows[0].nombre });
            console.log('[admin][guias] Approval email sent to:', u.rows[0].email);
          } catch (emailErr) {
            console.error('[admin][guias] Failed to send approval email:', emailErr.message);
          }
        }
      }
    } catch (e) {
      // non-blocking
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
    try {
      const q = await db.query(
        'SELECT d.*, pg.id_perfil_guia, u.nombre as guia_nombre FROM documentos_guia d JOIN perfil_guia pg ON pg.id_perfil_guia=d.id_perfil_guia JOIN usuario u ON u.id_usuario=pg.id_usuario WHERE d.estado=$1 ORDER BY d.id_documento_guia DESC LIMIT $2 OFFSET $3',
        [estado, Number(pageSize), offset]
      );
      const rows = await Promise.all(q.rows.map(async (d) => {
        if (d.archivo_url) {
          try {
            const signed = await obtenerUrlPublica(d.archivo_url, 1800);
            if (signed.success) d.documento_url_signed = signed.signedUrl;
          } catch (e) {}
          d.documento_url = d.archivo_url;
          d.url = d.archivo_url;
        }
        if (!d.estado_documento && d.estado) d.estado_documento = d.estado;
        return d;
      }));
      res.json({ success: true, data: rows });
    } catch (dbErr) {
      console.warn('[admin][documentos] fallback list:', dbErr.message);
      const q = await db.query(
        'SELECT d.*, pg.id_perfil_guia, u.nombre as guia_nombre FROM documentos_guia d JOIN perfil_guia pg ON pg.id_perfil_guia=d.id_perfil_guia JOIN usuario u ON u.id_usuario=pg.id_usuario ORDER BY d.id_documento_guia DESC LIMIT $1 OFFSET $2',
        [Number(pageSize), offset]
      );
      const rows = await Promise.all(q.rows.map(async (d) => {
        if (d.archivo_url) {
          try {
            const signed = await obtenerUrlPublica(d.archivo_url, 1800);
            if (signed.success) d.documento_url_signed = signed.signedUrl;
          } catch (e) {}
          d.documento_url = d.archivo_url;
          d.url = d.archivo_url;
        }
        if (!d.estado_documento && d.estado) d.estado_documento = d.estado;
        return d;
      }));
      res.json({ success: true, data: rows, warning: 'Using fallback order' });
    }
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
    
    try {
      const up = await db.query('UPDATE documentos_guia SET estado=$1, reviewed_by=$2, reviewed_at=NOW() WHERE id_documento_guia=$3 RETURNING *', [estado, reviewed_by || null, id_documento]);
      if (up.rows.length === 0) return res.status(404).json({ success: false, message: 'Documento no encontrado' });
      
      // notificar al guía dueño del documento
      try {
        const u = await db.query('SELECT u.id_usuario FROM documentos_guia d JOIN perfil_guia pg ON pg.id_perfil_guia=d.id_perfil_guia JOIN usuario u ON u.id_usuario=pg.id_usuario WHERE d.id_documento_guia=$1', [id_documento]);
        if (u.rows.length) {
          await db.query('INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje) VALUES ($1,$2,$3,$4)', [u.rows[0].id_usuario, 'otros', 'Revisión de documento', `Tu documento cambió a estado: ${estado}`]);
        }
      } catch (e) {
        console.error('[admin][documentos] notification error:', e.message);
      }
      
      res.json({ success: true, data: up.rows[0] });
    } catch (dbErr) {
      console.error('[admin][documentos] setEstado DB error (may need migration):', dbErr.message);
      return res.status(500).json({ success: false, message: 'Error al actualizar documento. Las columnas necesarias pueden no existir en la base de datos.' });
    }
  } catch (err) {
    console.error('[admin][documentos] setEstado error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// DELETE /api/waylo/admin/guias/:id/fotos/:id_foto
async function deleteFotoGuia(req, res) {
  try {
    const { id, id_foto } = req.params; // id = id_perfil_guia, id_foto = id_foto_guia
    const { reason } = req.body; // Motivo de eliminación (opcional)
    
    // Obtener información de la foto y del guía
    const fotoQuery = await db.query(
      'SELECT fg.*, u.email, u.nombre FROM fotos_guia fg JOIN perfil_guia pg ON pg.id_perfil_guia = fg.id_perfil_guia JOIN usuario u ON u.id_usuario = pg.id_usuario WHERE fg.id_foto_guia = $1 AND fg.id_perfil_guia = $2',
      [id_foto, id]
    );
    
    if (fotoQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Foto no encontrada' });
    }
    
    const foto = fotoQuery.rows[0];
    
    // Eliminar de Supabase si existe foto_url
    if (foto.foto_url) {
      try {
        await eliminarImagen(foto.foto_url);
        console.log('[admin][fotos] Deleted from storage:', foto.foto_url);
      } catch (storageErr) {
        console.error('[admin][fotos] Failed to delete from storage:', storageErr.message);
        // Continue even if storage deletion fails
      }
    }
    
    // Eliminar de base de datos
    await db.query('DELETE FROM fotos_guia WHERE id_foto_guia = $1', [id_foto]);
    
    // Enviar email al guía notificando la eliminación
    try {
      await sendPhotoDeletedEmail({
        to: foto.email,
        displayName: foto.nombre,
        reason: reason || 'No cumple con las políticas de contenido de Waylo'
      });
      console.log('[admin][fotos] Deletion notification email sent to:', foto.email);
    } catch (emailErr) {
      console.error('[admin][fotos] Failed to send deletion email:', emailErr.message);
      // Non-blocking - continue even if email fails
    }
    
    // Crear notificación en la app
    try {
      await db.query(
        'INSERT INTO notificacion (id_usuario, tipo, titulo, mensaje) VALUES ($1, $2, $3, $4)',
        [
          foto.id_usuario,
          'otros',
          'Foto eliminada',
          `Una de tus fotos fue eliminada. Motivo: ${reason || 'No cumple con las políticas de contenido'}`
        ]
      );
    } catch (notifErr) {
      console.error('[admin][fotos] Failed to create notification:', notifErr.message);
    }
    
    res.json({ success: true, message: 'Foto eliminada exitosamente' });
  } catch (err) {
    console.error('[admin][fotos] deleteFotoGuia error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { listGuias, getGuia, setVerification, listDocumentos, setDocumentoEstado, deleteFotoGuia };
