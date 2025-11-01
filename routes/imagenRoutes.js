const express = require("express");
const router = express.Router();
const { obtenerUrlPublica, obtenerMultiplesUrls } = require("../services/imageService");

// ======================
// RUTAS DE IMÁGENES
// ======================

// POST /api/imagenes/url - Obtener URL firmada para una imagen
router.post("/url", async (req, res) => {
  try {
    const { imagePath, expiresIn = 3600 } = req.body;

    if (!imagePath) {
      return res.status(400).json({ 
        success: false, 
        message: "Path de la imagen es requerido" 
      });
    }

    const result = await obtenerUrlPublica(imagePath, expiresIn);

    if (!result.success) {
      return res.status(404).json({ 
        success: false, 
        message: result.error 
      });
    }

    res.json({
      success: true,
      data: {
        imagePath: imagePath,
        signedUrl: result.signedUrl,
        expiresIn: expiresIn
      }
    });

  } catch (error) {
    console.error('Error al obtener URL de imagen:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
});

// POST /api/imagenes/urls-multiples - Obtener múltiples URLs firmadas
router.post("/urls-multiples", async (req, res) => {
  try {
    const { imagePaths, expiresIn = 3600 } = req.body;

    if (!imagePaths || !Array.isArray(imagePaths)) {
      return res.status(400).json({ 
        success: false, 
        message: "Array de paths de imágenes es requerido" 
      });
    }

    const result = await obtenerMultiplesUrls(imagePaths, expiresIn);

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        message: result.error 
      });
    }

    res.json({
      success: true,
      data: result.urls
    });

  } catch (error) {
    console.error('Error al obtener URLs múltiples:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
});

module.exports = router;