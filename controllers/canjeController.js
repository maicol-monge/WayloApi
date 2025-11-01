const { db } = require("../config/db");
const { actualizarStock } = require("./productoController");
const { obtenerUrlPublica } = require("../services/imageService");

// ======================
// CANJES - Controladores
// ======================

// Realizar canje
const realizarCanje = async (req, res) => {
  const client = await db.connect();
  
  try {
  const { id_usuario, id_producto, cantidad_producto } = req.body;

    if (!id_usuario || !id_producto) {
      return res.status(400).json({ 
        success: false, 
        message: "Usuario y producto son requeridos" 
      });
    }

    await client.query('BEGIN');

    // Obtener datos del producto
    const producto = await client.query(
      `SELECT p.*, t.id_tienda, t.nombre as tienda_nombre
       FROM Productos p
       JOIN Tienda t ON p.id_tienda = t.id_tienda
       WHERE p.id_producto = $1 AND p.estado = 'A' AND t.estado = 'A'`,
      [id_producto]
    );

    if (producto.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: "Producto no encontrado" 
      });
    }

    const prod = producto.rows[0];

    // Verificar stock
    const cantidad = Math.max(1, parseInt(cantidad_producto || 1, 10));

    if (prod.stock <= 0 || prod.stock < cantidad) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: "Producto sin stock disponible" 
      });
    }

    // Obtener puntos del usuario
    const usuario = await client.query(
      'SELECT puntos_acumulados FROM Usuarios WHERE id_usuario = $1 AND estado = $2',
      [id_usuario, 'A']
    );

    if (usuario.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: "Usuario no encontrado" 
      });
    }

    // Verificar puntos suficientes
    const costoTotal = prod.costo_puntos * cantidad;
    if (usuario.rows[0].puntos_acumulados < costoTotal) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        message: "Puntos insuficientes para realizar el canje" 
      });
    }

    // Registrar canje
    const canje = await client.query(
      `INSERT INTO Canjes 
       (id_tienda, id_usuario, id_producto, puntos_usados, cantidad_producto, estado) 
       VALUES ($1, $2, $3, $4, $5, 'A') 
       RETURNING *`,
      [prod.id_tienda, id_usuario, id_producto, costoTotal, cantidad]
    );

    // Actualizar puntos del usuario
    await client.query(
      'UPDATE Usuarios SET puntos_acumulados = puntos_acumulados - $1 WHERE id_usuario = $2',
      [costoTotal, id_usuario]
    );

    // Actualizar stock del producto
    await client.query(
      'UPDATE Productos SET stock = stock - $1 WHERE id_producto = $2',
      [cantidad, id_producto]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: "Canje realizado exitosamente",
      data: {
        ...canje.rows[0],
        producto_nombre: prod.nombre,
        tienda_nombre: prod.tienda_nombre
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al realizar canje:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  } finally {
    client.release();
  }
};

// Obtener canjes por usuario
const obtenerCanjesUsuario = async (req, res) => {
  try {
    const { id_usuario } = req.params;

    const canjes = await db.query(
      `SELECT c.*, c.cantidad_producto, c.puntos_usados,
              p.nombre as producto_nombre, p.descripcion as producto_descripcion,
              p.imagen as producto_imagen,
              t.nombre as tienda_nombre, t.direccion as tienda_direccion
       FROM Canjes c
       JOIN Productos p ON c.id_producto = p.id_producto
       JOIN Tienda t ON c.id_tienda = t.id_tienda
       WHERE c.id_usuario = $1 AND c.estado = 'A'
       ORDER BY c.fecha DESC`,
      [id_usuario]
    );

    // Añadir URL firmada de la imagen del producto
    const canjesConImagen = await Promise.all(
      canjes.rows.map(async (row) => {
        if (row.producto_imagen) {
          const urlRes = await obtenerUrlPublica(row.producto_imagen);
          if (urlRes.success) {
            row.producto_imagen_url = urlRes.signedUrl;
          }
        }
        return row;
      })
    );

    res.json({
      success: true,
      data: canjesConImagen
    });

  } catch (error) {
    console.error('Error al obtener canjes:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener canjes por tienda
const obtenerCanjesTienda = async (req, res) => {
  try {
    const { id_tienda } = req.params;

    const canjes = await db.query(
      `SELECT c.*, c.cantidad_producto, c.puntos_usados,
              p.nombre as producto_nombre, p.descripcion as producto_descripcion,
              p.imagen as producto_imagen,
              u.nombre as usuario_nombre, u.apellido as usuario_apellido,
              u.documento_num as usuario_documento
       FROM Canjes c
       JOIN Productos p ON c.id_producto = p.id_producto
       JOIN Usuarios u ON c.id_usuario = u.id_usuario
       WHERE c.id_tienda = $1 AND c.estado = 'A'
       ORDER BY c.fecha DESC`,
      [id_tienda]
    );

    // Añadir URL firmada de la imagen del producto
    const canjesConImagen = await Promise.all(
      canjes.rows.map(async (row) => {
        if (row.producto_imagen) {
          const urlRes = await obtenerUrlPublica(row.producto_imagen);
          if (urlRes.success) {
            row.producto_imagen_url = urlRes.signedUrl;
          }
        }
        return row;
      })
    );

    res.json({
      success: true,
      data: canjesConImagen
    });

  } catch (error) {
    console.error('Error al obtener canjes de tienda:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Verificar disponibilidad de canje
const verificarDisponibilidadCanje = async (req, res) => {
  try {
  const { id_usuario, id_producto, cantidad_producto } = req.body;

    if (!id_usuario || !id_producto) {
      return res.status(400).json({ 
        success: false, 
        message: "Usuario y producto son requeridos" 
      });
    }

    // Obtener producto y puntos del usuario
    const cant = Math.max(1, parseInt(cantidad_producto || 1, 10));
    const verificacion = await db.query(
      `SELECT 
         p.id_producto, p.nombre, p.costo_puntos, p.stock,
         u.puntos_acumulados,
         CASE 
           WHEN u.puntos_acumulados >= p.costo_puntos * $3 AND p.stock >= $3 THEN true 
           ELSE false 
         END as puede_canjear,
         CASE 
           WHEN u.puntos_acumulados < p.costo_puntos * $3 THEN 'puntos_insuficientes'
           WHEN p.stock < $3 THEN 'sin_stock'
           ELSE 'disponible'
         END as motivo
       FROM Productos p
       CROSS JOIN Usuarios u
       WHERE p.id_producto = $1 AND u.id_usuario = $2 
         AND p.estado = 'A' AND u.estado = 'A'`,
      [id_producto, id_usuario, cant]
    );

    if (verificacion.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Producto o usuario no encontrado" 
      });
    }

    res.json({
      success: true,
      data: verificacion.rows[0]
    });

  } catch (error) {
    console.error('Error al verificar disponibilidad:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

module.exports = {
  realizarCanje,
  obtenerCanjesUsuario,
  obtenerCanjesTienda,
  verificarDisponibilidadCanje
};