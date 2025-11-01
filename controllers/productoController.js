const { db } = require("../config/db");
const { subirImagen, obtenerUrlPublica, eliminarImagen, validarImagen, obtenerMultiplesUrls } = require("../services/imageService");
const multer = require('multer');

// Configurar multer para manejar archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});

// ======================
// PRODUCTOS - Controladores
// ======================

// Crear producto (para tiendas) - CON IMAGEN
const crearProducto = async (req, res) => {
  try {
    const { id_tienda, nombre, descripcion, costo_puntos, stock } = req.body;
    const imagen = req.file; // Archivo de imagen desde multer

    if (!id_tienda || !nombre || !costo_puntos || !stock) {
      return res.status(400).json({ 
        success: false, 
        message: "Tienda, nombre, costo en puntos y stock son requeridos" 
      });
    }

    // Verificar que la tienda existe
    const tiendaExiste = await db.query(
      'SELECT id_tienda FROM Tienda WHERE id_tienda = $1 AND estado = $2',
      [id_tienda, 'A']
    );

    if (tiendaExiste.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Tienda no encontrada" 
      });
    }

    let imagenPath = null;

    // Si hay imagen, validarla y subirla
    if (imagen) {
      const validacion = validarImagen(imagen.originalname, imagen.size);
      if (!validacion.valid) {
        return res.status(400).json({ 
          success: false, 
          message: validacion.error 
        });
      }

      // Subir imagen a Supabase
      const resultadoImagen = await subirImagen(
        imagen.buffer, 
        imagen.originalname, 
        'productos'
      );

      if (!resultadoImagen.success) {
        return res.status(500).json({ 
          success: false, 
          message: `Error al subir imagen: ${resultadoImagen.error}` 
        });
      }

      imagenPath = resultadoImagen.data.path;
    }

    // Insertar producto
    const resultado = await db.query(
      `INSERT INTO Productos 
       (id_tienda, nombre, descripcion, costo_puntos, stock, imagen, estado) 
       VALUES ($1, $2, $3, $4, $5, $6, 'A') 
       RETURNING *`,
      [id_tienda, nombre, descripcion, costo_puntos, stock, imagenPath]
    );

    // Si el producto se creó y tiene imagen, obtener la URL firmada
    const producto = resultado.rows[0];
    if (producto.imagen) {
      const urlResult = await obtenerUrlPublica(producto.imagen);
      if (urlResult.success) {
        producto.imagen_url = urlResult.signedUrl;
      }
    }

    res.status(201).json({
      success: true,
      message: "Producto creado exitosamente",
      data: producto
    });

  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener todos los productos disponibles - CON URLS DE IMÁGENES
const obtenerProductos = async (req, res) => {
  try {
    const productos = await db.query(
      `SELECT p.*, t.nombre as tienda_nombre, t.direccion as tienda_direccion
       FROM Productos p
       JOIN Tienda t ON p.id_tienda = t.id_tienda
       WHERE p.estado = 'A' AND p.stock > 0 AND t.estado = 'A'
       ORDER BY p.nombre`
    );

    // Obtener URLs firmadas para las imágenes
    const productosConImagenes = await Promise.all(
      productos.rows.map(async (producto) => {
        if (producto.imagen) {
          const urlResult = await obtenerUrlPublica(producto.imagen);
          if (urlResult.success) {
            producto.imagen_url = urlResult.signedUrl;
          }
        }
        return producto;
      })
    );

    res.json({
      success: true,
      data: productosConImagenes
    });

  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener producto por ID - CON URL DE IMAGEN
const obtenerProductoPorId = async (req, res) => {
  try {
    const { id_producto } = req.params;

    const producto = await db.query(
      `SELECT p.*, t.nombre as tienda_nombre, t.direccion as tienda_direccion
       FROM Productos p
       JOIN Tienda t ON p.id_tienda = t.id_tienda
       WHERE p.id_producto = $1 AND p.estado = 'A' AND t.estado = 'A'`,
      [id_producto]
    );

    if (producto.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Producto no encontrado" 
      });
    }

    const prod = producto.rows[0];

    // Obtener URL firmada para la imagen
    if (prod.imagen) {
      const urlResult = await obtenerUrlPublica(prod.imagen);
      if (urlResult.success) {
        prod.imagen_url = urlResult.signedUrl;
      }
    }

    res.json({
      success: true,
      data: prod
    });

  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Actualizar stock de producto (función interna)
const actualizarStock = async (id_producto, cantidad, operacion = 'restar') => {
  try {
    const query = operacion === 'restar' 
      ? 'UPDATE Productos SET stock = stock - $1 WHERE id_producto = $2 AND stock >= $1'
      : 'UPDATE Productos SET stock = stock + $1 WHERE id_producto = $2';
    
    const resultado = await db.query(query, [cantidad, id_producto]);
    return resultado.rowCount > 0;
  } catch (error) {
    console.error('Error al actualizar stock:', error);
    return false;
  }
};

// Buscar productos por nombre - CON URLS DE IMÁGENES
const buscarProductos = async (req, res) => {
  try {
    const { q } = req.query; // query parameter

    if (!q) {
      return res.status(400).json({ 
        success: false, 
        message: "Parámetro de búsqueda requerido" 
      });
    }

    const productos = await db.query(
      `SELECT p.*, t.nombre as tienda_nombre, t.direccion as tienda_direccion
       FROM Productos p
       JOIN Tienda t ON p.id_tienda = t.id_tienda
       WHERE (LOWER(p.nombre) LIKE LOWER($1) OR LOWER(p.descripcion) LIKE LOWER($1))
         AND p.estado = 'A' AND p.stock > 0 AND t.estado = 'A'
       ORDER BY p.nombre`,
      [`%${q}%`]
    );

    // Obtener URLs firmadas para las imágenes
    const productosConImagenes = await Promise.all(
      productos.rows.map(async (producto) => {
        if (producto.imagen) {
          const urlResult = await obtenerUrlPublica(producto.imagen);
          if (urlResult.success) {
            producto.imagen_url = urlResult.signedUrl;
          }
        }
        return producto;
      })
    );

    res.json({
      success: true,
      data: productosConImagenes
    });

  } catch (error) {
    console.error('Error al buscar productos:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Actualizar producto con nueva imagen
const actualizarProducto = async (req, res) => {
  try {
    const { id_producto } = req.params;
    const { nombre, descripcion, costo_puntos, stock } = req.body;
    const nuevaImagen = req.file;

    if (!nombre || !costo_puntos || stock === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: "Nombre, costo en puntos y stock son requeridos" 
      });
    }

    // Verificar que el producto existe
    const productoExistente = await db.query(
      'SELECT * FROM Productos WHERE id_producto = $1 AND estado = $2',
      [id_producto, 'A']
    );

    if (productoExistente.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Producto no encontrado" 
      });
    }

    let imagenPath = productoExistente.rows[0].imagen;

    // Si hay nueva imagen, validarla y subirla
    if (nuevaImagen) {
      const validacion = validarImagen(nuevaImagen.originalname, nuevaImagen.size);
      if (!validacion.valid) {
        return res.status(400).json({ 
          success: false, 
          message: validacion.error 
        });
      }

      // Subir nueva imagen
      const resultadoImagen = await subirImagen(
        nuevaImagen.buffer, 
        nuevaImagen.originalname, 
        'productos'
      );

      if (!resultadoImagen.success) {
        return res.status(500).json({ 
          success: false, 
          message: `Error al subir imagen: ${resultadoImagen.error}` 
        });
      }

      // Eliminar imagen anterior si existe
      if (imagenPath) {
        await eliminarImagen(imagenPath);
      }

      imagenPath = resultadoImagen.data.path;
    }

    // Actualizar producto
    const resultado = await db.query(
      `UPDATE Productos 
       SET nombre = $1, descripcion = $2, costo_puntos = $3, stock = $4, imagen = $5
       WHERE id_producto = $6 AND estado = 'A'
       RETURNING *`,
      [nombre, descripcion, costo_puntos, stock, imagenPath, id_producto]
    );

    const producto = resultado.rows[0];

    // Obtener URL firmada para la imagen
    if (producto.imagen) {
      const urlResult = await obtenerUrlPublica(producto.imagen);
      if (urlResult.success) {
        producto.imagen_url = urlResult.signedUrl;
      }
    }

    res.json({
      success: true,
      message: "Producto actualizado exitosamente",
      data: producto
    });

  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Eliminar producto (cambiar estado y eliminar imagen)
const eliminarProducto = async (req, res) => {
  try {
    const { id_producto } = req.params;

    // Obtener datos del producto antes de eliminarlo
    const producto = await db.query(
      'SELECT * FROM Productos WHERE id_producto = $1 AND estado = $2',
      [id_producto, 'A']
    );

    if (producto.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Producto no encontrado" 
      });
    }

    // Cambiar estado del producto
    const resultado = await db.query(
      `UPDATE Productos 
       SET estado = 'I'
       WHERE id_producto = $1 AND estado = 'A'
       RETURNING id_producto, nombre`,
      [id_producto]
    );


    res.json({
      success: true,
      message: "Producto eliminado exitosamente",
      data: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al eliminar producto:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Nuevos listados por stock
const obtenerProductosAgotados = async (req, res) => {
    try {
      const { id_tienda } = req.query;
      const tiendaId = parseInt(id_tienda, 10);
      if (!id_tienda || isNaN(tiendaId)) {
        return res.status(400).json({ success: false, message: 'id_tienda requerido y debe ser numérico' });
      }

      const productos = await db.query(
        `SELECT p.*, t.nombre as tienda_nombre, t.direccion as tienda_direccion
         FROM Productos p
         JOIN Tienda t ON p.id_tienda = t.id_tienda
         WHERE p.estado = 'A' AND t.estado = 'A' AND p.stock <= 0 AND p.id_tienda = $1
         ORDER BY p.nombre`,
        [tiendaId]
      );

      const productosConImagenes = await Promise.all(
        productos.rows.map(async (producto) => {
          if (producto.imagen) {
            const urlResult = await obtenerUrlPublica(producto.imagen);
            if (urlResult.success) {
              producto.imagen_url = urlResult.signedUrl;
            }
          }
          return producto;
        })
      );

      res.json({ success: true, data: productosConImagenes });
    } catch (error) {
      console.error('Error al obtener productos agotados:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  };

  const obtenerProductosConStock = async (req, res) => {
    try {
      const { id_tienda } = req.query;
      const tiendaId = parseInt(id_tienda, 10);
      if (!id_tienda || isNaN(tiendaId)) {
        return res.status(400).json({ success: false, message: 'id_tienda requerido y debe ser numérico' });
      }

      const productos = await db.query(
        `SELECT p.*, t.nombre as tienda_nombre, t.direccion as tienda_direccion
         FROM Productos p
         JOIN Tienda t ON p.id_tienda = t.id_tienda
         WHERE p.estado = 'A' AND p.stock > 0 AND t.estado = 'A' AND p.id_tienda = $1
         ORDER BY p.nombre`,
        [tiendaId]
      );

      const productosConImagenes = await Promise.all(
        productos.rows.map(async (producto) => {
          if (producto.imagen) {
            const urlResult = await obtenerUrlPublica(producto.imagen);
            if (urlResult.success) {
              producto.imagen_url = urlResult.signedUrl;
            }
          }
          return producto;
        })
      );

      res.json({ success: true, data: productosConImagenes });
    } catch (error) {
      console.error('Error al obtener productos con stock:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  };

  const obtenerTodosProductos = async (req, res) => {
    try {
      const { id_tienda } = req.query;
      const tiendaId = parseInt(id_tienda, 10);
      if (!id_tienda || isNaN(tiendaId)) {
        return res.status(400).json({ success: false, message: 'id_tienda requerido y debe ser numérico' });
      }

      const productos = await db.query(
        `SELECT p.*, t.nombre as tienda_nombre, t.direccion as tienda_direccion
         FROM Productos p
         JOIN Tienda t ON p.id_tienda = t.id_tienda
         WHERE p.estado = 'A' AND t.estado = 'A' AND p.id_tienda = $1
         ORDER BY p.nombre`,
        [tiendaId]
      );

      const productosConImagenes = await Promise.all(
        productos.rows.map(async (producto) => {
          if (producto.imagen) {
            const urlResult = await obtenerUrlPublica(producto.imagen);
            if (urlResult.success) {
              producto.imagen_url = urlResult.signedUrl;
            }
          }
          return producto;
        })
      );

      res.json({ success: true, data: productosConImagenes });
    } catch (error) {
      console.error('Error al obtener todos los productos:', error);
      res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
  };

module.exports = {
  upload, // Middleware de multer para subir archivos
  crearProducto,
  obtenerProductos,
  obtenerProductoPorId,
  actualizarStock,
  buscarProductos,
  actualizarProducto,
  eliminarProducto,
  obtenerProductosAgotados,
  obtenerProductosConStock,
  obtenerTodosProductos
  
};