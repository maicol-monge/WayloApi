const { db } = require("../config/db");
const { actualizarPuntos } = require("./usuarioController");

// ======================
// RECICLAJES - Controladores
// ======================

// Registrar reciclaje
const registrarReciclaje = async (req, res) => {
  const client = await db.connect();
  
  try {
    const { id_usuario, id_tienda, id_objeto, peso, codigo_qr } = req.body;

    if (!id_usuario || !id_tienda || !id_objeto || !peso) {
      return res.status(400).json({ 
        success: false, 
        message: "Usuario, tienda, objeto y peso son requeridos" 
      });
    }

    await client.query('BEGIN');

    // Obtener valor por peso del objeto
    const objeto = await client.query(
      'SELECT * FROM Objetos WHERE id_objeto = $1 AND estado = $2',
      [id_objeto, 'A']
    );

    if (objeto.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        message: "Objeto no encontrado" 
      });
    }

    // Calcular puntos ganados
    const puntos_ganados = Math.floor(peso * objeto.rows[0].valor_por_peso);

    // Insertar reciclaje
    const reciclaje = await client.query(
      `INSERT INTO Reciclajes 
       (id_usuario, id_tienda, id_objeto, peso, puntos_ganados, codigo_qr, estado) 
       VALUES ($1, $2, $3, $4, $5, $6, 'A') 
       RETURNING *`,
      [id_usuario, id_tienda, id_objeto, peso, puntos_ganados, codigo_qr]
    );

    // Actualizar puntos del usuario
    await client.query(
      'UPDATE Usuarios SET puntos_acumulados = puntos_acumulados + $1 WHERE id_usuario = $2',
      [puntos_ganados, id_usuario]
    );

    // Obtener total actualizado de puntos del usuario
    const totalActual = await client.query(
      `SELECT puntos_acumulados FROM Usuarios WHERE id_usuario = $1`,
      [id_usuario]
    );
    const totalPuntos = parseInt(totalActual.rows[0].puntos_acumulados, 10) || 0;

    // Calcular posición actual del usuario tras la actualización
    const pos = await client.query(
      `SELECT COUNT(*) + 1 AS posicion
       FROM Usuarios WHERE estado = 'A' AND puntos_acumulados > $1`,
      [totalPuntos]
    );

    // Insertar snapshot en HistorialPuntaje
    await client.query(
      `INSERT INTO HistorialPuntaje (id_usuario, puntosmaximos, posicion, estado)
       VALUES ($1, $2, $3, 'A')`,
      [id_usuario, totalPuntos, pos.rows[0].posicion]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: "Reciclaje registrado exitosamente",
      data: {
        ...reciclaje.rows[0],
        objeto_nombre: objeto.rows[0].nombre,
        puntos_ganados: puntos_ganados
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar reciclaje:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  } finally {
    client.release();
  }
};

// Obtener reciclajes por usuario
const obtenerReciclajesUsuario = async (req, res) => {
  try {
    const { id_usuario } = req.params;

    const reciclajes = await db.query(
      `SELECT r.*, o.nombre as objeto_nombre, o.descripcion as objeto_descripcion,
              t.nombre as tienda_nombre, t.direccion as tienda_direccion
       FROM Reciclajes r
       JOIN Objetos o ON r.id_objeto = o.id_objeto
       JOIN Tienda t ON r.id_tienda = t.id_tienda
       WHERE r.id_usuario = $1 AND r.estado = 'A'
       ORDER BY r.fecha DESC`,
      [id_usuario]
    );

    res.json({
      success: true,
      data: reciclajes.rows
    });

  } catch (error) {
    console.error('Error al obtener reciclajes:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener reciclajes por tienda
const obtenerReciclajesTienda = async (req, res) => {
  try {
    const { id_tienda } = req.params;

    const reciclajes = await db.query(
      `SELECT r.*, o.nombre as objeto_nombre, o.descripcion as objeto_descripcion,
              u.nombre as usuario_nombre, u.apellido as usuario_apellido,
              u.documento_num as usuario_documento
       FROM Reciclajes r
       JOIN Objetos o ON r.id_objeto = o.id_objeto
       JOIN Usuarios u ON r.id_usuario = u.id_usuario
       WHERE r.id_tienda = $1 AND r.estado = 'A'
       ORDER BY r.fecha DESC`,
      [id_tienda]
    );

    res.json({
      success: true,
      data: reciclajes.rows
    });

  } catch (error) {
    console.error('Error al obtener reciclajes de tienda:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener estadísticas de reciclaje
const obtenerEstadisticasReciclaje = async (req, res) => {
  try {
    const estadisticas = await db.query(`
      SELECT 
        COUNT(*) as total_reciclajes,
        SUM(peso) as peso_total_reciclado,
        SUM(puntos_ganados) as puntos_totales_generados,
        COUNT(DISTINCT id_usuario) as usuarios_activos
      FROM Reciclajes 
      WHERE estado = 'A'
    `);

    const objetosMasReciclados = await db.query(`
      SELECT o.nombre, o.descripcion, COUNT(r.id_objeto) as cantidad_reciclajes,
             SUM(r.peso) as peso_total
      FROM Reciclajes r
      JOIN Objetos o ON r.id_objeto = o.id_objeto
      WHERE r.estado = 'A'
      GROUP BY o.id_objeto, o.nombre, o.descripcion
      ORDER BY cantidad_reciclajes DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        estadisticas_generales: estadisticas.rows[0],
        objetos_mas_reciclados: objetosMasReciclados.rows
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

module.exports = {
  registrarReciclaje,
  obtenerReciclajesUsuario,
  obtenerReciclajesTienda,
  obtenerEstadisticasReciclaje
};