const { db } = require('../../config/db');
const multer = require('multer');
const upload = multer();
const { subirImagen } = require('../../services/imageService');

// middleware exportable para rutas que suben archivos de documentos (imagen/pdf)
const uploadMiddleware = upload.single('file');

// POST /api/waylo/documentos/:id_perfil_guia
async function subirDocumento(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const { tipo_documento = 'ID' } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'Archivo requerido (campo file)' });

    console.log(`[documentos] subida perfil=${id_perfil_guia} tipo=${tipo_documento} original=${req.file.originalname} size=${req.file.size}B`);

    const result = await subirImagen(req.file.buffer, req.file.originalname, 'documentos');
    if (!result.success) return res.status(500).json({ success: false, message: result.error });

    const ins = await db.query(
      `INSERT INTO documentos_guia (id_perfil_guia, tipo_documento, archivo_url) VALUES ($1,$2,$3) RETURNING *`,
      [id_perfil_guia, tipo_documento, result.data.path]
    );

    res.status(201).json({ success: true, data: ins.rows[0] });
  } catch (err) {
    console.error('[waylo][documentos] subir error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { uploadMiddleware, subirDocumento };
