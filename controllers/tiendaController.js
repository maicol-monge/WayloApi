const { db } = require("../config/db");
const bcrypt = require("bcryptjs");
const { obtenerUrlPublica } = require("../services/imageService");

// ======================
// TIENDAS - Controladores
// ======================

// Registrar tienda
const registrarTienda = async (req, res) => {
  try {
  const { nombre, direccion, correo, password, municipio, departamento, pais } = req.body;

    if (!nombre || !correo || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Nombre, correo y contraseña son requeridos" 
      });
    }

    // Verificar si la tienda ya existe
    const tiendaExistente = await db.query(
      'SELECT * FROM Tienda WHERE correo = $1',
      [correo]
    );

    if (tiendaExistente.rows.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Tienda ya registrada con este correo" 
      });
    }

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insertar tienda
    const resultado = await db.query(
      `INSERT INTO Tienda 
       (nombre, direccion, correo, password, municipio, departamento, pais, estado) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'A') 
       RETURNING id_tienda, nombre, direccion, correo, municipio, departamento, pais, fecha_registro`,
      [nombre, direccion, correo, hashedPassword, municipio || null, departamento || null, pais || null]
    );

    res.status(201).json({
      success: true,
      message: "Tienda registrada exitosamente",
      data: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al registrar tienda:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Login tienda
const loginTienda = async (req, res) => {
  try {
    const { correo, password } = req.body;

    if (!correo || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Correo y contraseña son requeridos" 
      });
    }

    // Buscar tienda
    const tienda = await db.query(
      'SELECT * FROM Tienda WHERE correo = $1 AND estado = $2',
      [correo, 'A']
    );

    if (tienda.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: "Credenciales inválidas" 
      });
    }

    // Verificar contraseña
    const isValidPassword = await bcrypt.compare(password, tienda.rows[0].password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: "Credenciales inválidas" 
      });
    }

    // Excluir contraseña de la respuesta
    const { password: _, ...tiendaData } = tienda.rows[0];

    res.json({
      success: true,
      message: "Login exitoso",
      data: tiendaData
    });

  } catch (error) {
    console.error('Error en login tienda:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener todas las tiendas activas
const obtenerTiendas = async (req, res) => {
  try {
    const tiendas = await db.query(
      `SELECT id_tienda, nombre, direccion, correo, municipio, departamento, pais, fecha_registro 
       FROM Tienda 
       WHERE estado = 'A' 
       ORDER BY nombre`
    );

    res.json({
      success: true,
      data: tiendas.rows
    });

  } catch (error) {
    console.error('Error al obtener tiendas:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener tienda por ID
const obtenerTiendaPorId = async (req, res) => {
  try {
    const { id_tienda } = req.params;

    const tienda = await db.query(
      `SELECT id_tienda, nombre, direccion, correo, municipio, departamento, pais, fecha_registro 
       FROM Tienda 
       WHERE id_tienda = $1 AND estado = 'A'`,
      [id_tienda]
    );

    if (tienda.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Tienda no encontrada" 
      });
    }

    res.json({
      success: true,
      data: tienda.rows[0]
    });

  } catch (error) {
    console.error('Error al obtener tienda:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener productos de una tienda - CON URLS DE IMÁGENES
const obtenerProductosTienda = async (req, res) => {
  try {
    const { id_tienda } = req.params;

    const productos = await db.query(
      `SELECT id_producto, nombre, descripcion, costo_puntos, stock, imagen, fecha_creacion
       FROM Productos 
       WHERE id_tienda = $1 AND estado = 'A'
       ORDER BY nombre`,
      [id_tienda]
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

module.exports = {
  registrarTienda,
  loginTienda,
  obtenerTiendas,
  obtenerTiendaPorId,
  obtenerProductosTienda,
  // Nuevo: puntos redimidos/canjeados en una tienda
  obtenerPuntosRedimidosTienda,
  actualizarPerfilTienda,
  cambiarPasswordTienda
};

// ======================
// NUEVO: Puntos redimidos por tienda
// ======================
// Devuelve la suma de puntos_usados (canjeados) en una tienda específica,
// con filtros opcionales de fecha (desde/hasta), replicando la lógica del ranking de tiendas.
async function obtenerPuntosRedimidosTienda(req, res) {
  try {
    const { id_tienda } = req.params;
    const { desde, hasta } = req.query;

    if (!id_tienda) {
      return res.status(400).json({ success: false, message: "id_tienda es requerido" });
    }

    // Verificar tienda activa
    const tienda = await db.query(
      `SELECT id_tienda, nombre, estado FROM Tienda WHERE id_tienda = $1 AND estado = 'A'`,
      [id_tienda]
    );
    if (tienda.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Tienda no encontrada o inactiva" });
    }

    const conditions = ["c.estado = 'A'", "c.id_tienda = $1"]; // Sólo canjes activos de la tienda
    const params = [id_tienda];

    if (desde) {
      params.push(desde);
      conditions.push(`c.fecha >= $${params.length}`);
    }
    if (hasta) {
      params.push(hasta);
      conditions.push(`c.fecha <= $${params.length}`);
    }

    const query = `
      SELECT 
        COALESCE(SUM(c.puntos_usados), 0) AS puntos_redimidos,
        COUNT(c.id_canje) AS total_canjes,
        COUNT(DISTINCT c.id_usuario) AS usuarios_unicos
      FROM Canjes c
      WHERE ${conditions.join(' AND ')}
    `;

    const resultado = await db.query(query, params);

    res.json({
      success: true,
      data: {
        id_tienda: parseInt(id_tienda, 10),
        tienda_nombre: tienda.rows[0].nombre,
        puntos_redimidos: parseInt(resultado.rows[0].puntos_redimidos || 0, 10),
        total_canjes: parseInt(resultado.rows[0].total_canjes || 0, 10),
        usuarios_unicos: parseInt(resultado.rows[0].usuarios_unicos || 0, 10)
      }
    });

  } catch (error) {
    console.error('Error al obtener puntos redimidos por tienda:', error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
}

// ======================
// Actualizar perfil de tienda
// ======================
async function actualizarPerfilTienda(req, res) {
  try {
    const { id_tienda } = req.params;
    const { nombre, direccion, correo, municipio, departamento, pais } = req.body;

    if (correo !== undefined) {
      const existsCorreo = await db.query(
        `SELECT 1 FROM Tienda WHERE correo = $1 AND id_tienda <> $2 AND estado = 'A' LIMIT 1`,
        [correo, id_tienda]
      );
      if (existsCorreo.rows.length > 0) {
        return res.status(409).json({ success: false, message: 'El correo ya está en uso por otra tienda' });
      }
    }

    const fields = [];
    const values = [];
    let idx = 1;

    if (nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(nombre); }
    if (direccion !== undefined) { fields.push(`direccion = $${idx++}`); values.push(direccion); }
    if (correo !== undefined) { fields.push(`correo = $${idx++}`); values.push(correo); }
    if (municipio !== undefined) { fields.push(`municipio = $${idx++}`); values.push(municipio); }
    if (departamento !== undefined) { fields.push(`departamento = $${idx++}`); values.push(departamento); }
    if (pais !== undefined) { fields.push(`pais = $${idx++}`); values.push(pais); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: "No hay campos para actualizar" });
    }

    values.push(id_tienda);
    const result = await db.query(
      `UPDATE Tienda SET ${fields.join(', ')} WHERE id_tienda = $${idx} AND estado = 'A'
       RETURNING id_tienda, nombre, direccion, correo, municipio, departamento, pais, fecha_registro`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tienda no encontrada o inactiva' });
    }

    res.json({ success: true, message: 'Perfil de tienda actualizado', data: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar perfil de tienda:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}

// ======================
// Cambiar contraseña de tienda (requiere contraseña actual)
// ======================
async function cambiarPasswordTienda(req, res) {
  try {
    const { id_tienda } = req.params;
    const { password_actual, password_nueva } = req.body;

    if (!password_actual || !password_nueva) {
      return res.status(400).json({ success: false, message: 'password_actual y password_nueva son requeridos' });
    }

    const q = await db.query(`SELECT password FROM Tienda WHERE id_tienda = $1 AND estado = 'A'`, [id_tienda]);
    if (q.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tienda no encontrada o inactiva' });
    }

    const ok = await bcrypt.compare(password_actual, q.rows[0].password);
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Contraseña actual incorrecta' });
    }

    if (String(password_nueva).length < 8) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const hashed = await bcrypt.hash(password_nueva, 10);
    await db.query(`UPDATE Tienda SET password = $1 WHERE id_tienda = $2`, [hashed, id_tienda]);

    res.json({ success: true, message: 'Contraseña de tienda actualizada correctamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña de tienda:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
}