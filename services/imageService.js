const { supabaseAdmin, BUCKET_NAME } = require('../config/supabase');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ======================
// SERVICIO DE IMÁGENES
// ======================

/**
 * Subir imagen a Supabase Storage
 * @param {Buffer} fileBuffer - Buffer del archivo
 * @param {string} fileName - Nombre original del archivo
 * @param {string} folder - Carpeta donde guardar (productos, usuarios, etc.)
 * @returns {Object} - Resultado de la subida
 */
const subirImagen = async (fileBuffer, fileName, folder = 'productos') => {
  try {
    // Generar nombre único para el archivo
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `${folder}/${uuidv4()}${fileExtension}`;

    // Subir archivo a Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(uniqueFileName, fileBuffer, {
        contentType: getContentType(fileExtension),
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error al subir imagen a Supabase:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data: {
        path: data.path,
        publicUrl: getPublicUrl(data.path),
        fileName: uniqueFileName
      }
    };

  } catch (error) {
    console.error('Error en subirImagen:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Obtener URL pública de una imagen (con token temporal para bucket privado)
 * @param {string} imagePath - Path de la imagen en Supabase
 * @param {number} expiresIn - Tiempo de expiración en segundos (default: 3600 = 1 hora)
 * @returns {Object} - URL firmada temporal
 */
const obtenerUrlPublica = async (imagePath, expiresIn = 3600) => {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(imagePath, expiresIn);

    if (error) {
      console.error('Error al obtener URL pública:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      signedUrl: data.signedUrl
    };

  } catch (error) {
    console.error('Error en obtenerUrlPublica:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Eliminar imagen de Supabase Storage
 * @param {string} imagePath - Path de la imagen a eliminar
 * @returns {Object} - Resultado de la eliminación
 */
const eliminarImagen = async (imagePath) => {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .remove([imagePath]);

    if (error) {
      console.error('Error al eliminar imagen:', error);
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('Error en eliminarImagen:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Obtener múltiples URLs públicas para una lista de imágenes
 * @param {Array} imagePaths - Array de paths de imágenes
 * @param {number} expiresIn - Tiempo de expiración en segundos
 * @returns {Object} - URLs firmadas
 */
const obtenerMultiplesUrls = async (imagePaths, expiresIn = 3600) => {
  try {
    const urls = await Promise.all(
      imagePaths.map(async (imagePath) => {
        if (!imagePath) return null;
        const result = await obtenerUrlPublica(imagePath, expiresIn);
        return result.success ? {
          path: imagePath,
          url: result.signedUrl
        } : null;
      })
    );

    return {
      success: true,
      urls: urls.filter(url => url !== null)
    };

  } catch (error) {
    console.error('Error en obtenerMultiplesUrls:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Determinar el content-type basado en la extensión del archivo
 * @param {string} fileExtension - Extensión del archivo
 * @returns {string} - Content type
 */
const getContentType = (fileExtension) => {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };

  return contentTypes[fileExtension.toLowerCase()] || 'image/jpeg';
};

/**
 * Generar URL pública básica (para referencia, pero necesita token para bucket privado)
 * @param {string} path - Path del archivo
 * @returns {string} - URL básica
 */
const getPublicUrl = (path) => {
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${path}`;
};

/**
 * Validar si el archivo es una imagen válida
 * @param {string} fileName - Nombre del archivo
 * @param {number} fileSize - Tamaño del archivo en bytes
 * @returns {Object} - Resultado de la validación
 */
const validarImagen = (fileName, fileSize) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  const fileExtension = path.extname(fileName).toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    return {
      valid: false,
      error: 'Tipo de archivo no permitido. Solo se permiten: JPG, JPEG, PNG, GIF, WEBP'
    };
  }

  if (fileSize > maxSize) {
    return {
      valid: false,
      error: 'El archivo es demasiado grande. Máximo 5MB permitido'
    };
  }

  return {
    valid: true
  };
};

module.exports = {
  subirImagen,
  obtenerUrlPublica,
  eliminarImagen,
  obtenerMultiplesUrls,
  validarImagen,
  getContentType,
  getPublicUrl
};