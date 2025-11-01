const multer = require('multer');
const upload = multer();
const { subirImagen } = require('../../services/imageService');
const { db } = require('../../config/db');

const uploadSingle = upload.single('file');

// POST /api/waylo/media/upload/foto
async function uploadFoto(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Archivo requerido (campo file)' });
    // Validar extensión de imagen
    const lower = (req.file.originalname || '').toLowerCase();
    if (!/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) {
      return res.status(400).json({ success: false, message: 'Solo se permiten imágenes: JPG, JPEG, PNG, GIF, WEBP' });
    }
    const result = await subirImagen(req.file.buffer, req.file.originalname, 'fotos');
    if (!result.success) return res.status(500).json({ success: false, message: result.error });
    res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    console.error('[waylo][media] upload foto error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/media/upload/foto-perfil
async function uploadFotoPerfil(req, res) {
  try {
    const { tipo, id } = req.body; // tipo: 'guia' | 'cliente', id: id_perfil
    if (!req.file) return res.status(400).json({ success: false, message: 'Archivo requerido (campo file)' });
    if (!tipo || !id) return res.status(400).json({ success: false, message: 'tipo (guia|cliente) e id requeridos' });
    const lower = (req.file.originalname || '').toLowerCase();
    if (!/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) {
      return res.status(400).json({ success: false, message: 'Foto de perfil debe ser imagen: JPG, JPEG, PNG, GIF, WEBP' });
    }

    const result = await subirImagen(req.file.buffer, req.file.originalname, 'foto-perfil');
    if (!result.success) return res.status(500).json({ success: false, message: result.error });

    if (String(tipo).toLowerCase() === 'guia') {
      await db.query('UPDATE perfil_guia SET imagen_perfil=$1 WHERE id_perfil_guia=$2', [result.data.path, id]);
    } else {
      await db.query('UPDATE perfil_cliente SET imagen_perfil=$1 WHERE id_perfil_cliente=$2', [result.data.path, id]);
    }

    res.status(201).json({ success: true, data: result.data });
  } catch (err) {
    console.error('[waylo][media] upload foto-perfil error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// POST /api/waylo/media/guias/:id_perfil_guia/fotos
async function agregarFotoGuia(req, res) {
  try {
    const { id_perfil_guia } = req.params;
    const { descripcion } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: 'Archivo requerido (campo file)' });
    const lower = (req.file.originalname || '').toLowerCase();
    if (!/\.(jpg|jpeg|png|gif|webp)$/.test(lower)) {
      return res.status(400).json({ success: false, message: 'Solo se permiten imágenes: JPG, JPEG, PNG, GIF, WEBP' });
    }
    const result = await subirImagen(req.file.buffer, req.file.originalname, 'fotos');
    if (!result.success) return res.status(500).json({ success: false, message: result.error });

    const ins = await db.query('INSERT INTO fotos_guia (id_perfil_guia, foto_url, descripcion) VALUES ($1,$2,$3) RETURNING *', [id_perfil_guia, result.data.path, descripcion || null]);
    res.status(201).json({ success: true, data: { storage: result.data, registro: ins.rows[0] } });
  } catch (err) {
    console.error('[waylo][media] agregar foto guia error:', err);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

module.exports = { uploadSingle, uploadFoto, uploadFotoPerfil, agregarFotoGuia };
