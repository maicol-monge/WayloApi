const { db } = require("../config/db");

// ======================
// RANKING - Controladores
// ======================

// Obtener ranking de tiendas por puntos redimidos (canjeados)
const obtenerRankingTiendas = async (req, res) => {
  try {
    const { limit = 50, desde, hasta } = req.query;

    const conditions = ["c.estado = 'A'", "t.estado = 'A'"];
    const params = [];

    if (desde) {
      params.push(desde);
      conditions.push(`c.fecha >= $${params.length}`);
    }
    if (hasta) {
      params.push(hasta);
      conditions.push(`c.fecha <= $${params.length}`);
    }

    params.push(limit);

    const query = `
      SELECT 
        t.id_tienda,
        t.nombre AS tienda_nombre,
        t.direccion,
        t.municipio,
        t.departamento,
        t.pais,
        COALESCE(SUM(c.puntos_usados), 0) AS puntos_redimidos,
        COUNT(c.id_canje) AS total_canjes,
        COUNT(DISTINCT c.id_usuario) AS usuarios_unicos,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.puntos_usados), 0) DESC, COUNT(c.id_canje) DESC) AS posicion
      FROM Tienda t
      JOIN Canjes c ON c.id_tienda = t.id_tienda
      WHERE ${conditions.join(' AND ')}
      GROUP BY t.id_tienda, t.nombre, t.direccion, t.municipio, t.departamento, t.pais
      ORDER BY puntos_redimidos DESC, total_canjes DESC
      LIMIT $${params.length}
    `;

    const resultado = await db.query(query, params);

    res.json({
      success: true,
      data: resultado.rows
    });

  } catch (error) {
    console.error('Error al obtener ranking de tiendas:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener ranking de usuarios por puntos históricos (HistorialPuntaje)
const obtenerRankingUsuarios = async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const ranking = await db.query(
      `WITH h AS (
         SELECT id_usuario, puntosmaximos, fecha_actualizacion,
                ROW_NUMBER() OVER (PARTITION BY id_usuario ORDER BY fecha_actualizacion DESC NULLS LAST) rn
         FROM HistorialPuntaje
         WHERE estado = 'A'
       ), ultimo AS (
         SELECT id_usuario, puntosmaximos FROM h WHERE rn = 1
       )
       SELECT 
         u.id_usuario,
         u.nombre,
         u.apellido,
         COALESCE(ul.puntosmaximos, 0) AS puntos_acumulados,
         ROW_NUMBER() OVER (ORDER BY COALESCE(ul.puntosmaximos, 0) DESC) AS posicion,
         COUNT(r.id_reciclaje) AS total_reciclajes,
         COALESCE(SUM(r.peso), 0) AS peso_total_reciclado
       FROM Usuarios u
       LEFT JOIN ultimo ul ON ul.id_usuario = u.id_usuario
       LEFT JOIN Reciclajes r ON u.id_usuario = r.id_usuario AND r.estado = 'A'
       WHERE u.estado = 'A'
       GROUP BY u.id_usuario, u.nombre, u.apellido, ul.puntosmaximos
       ORDER BY puntos_acumulados DESC
       LIMIT $1`,
      [limit]
    );

    res.json({ success: true, data: ranking.rows });

  } catch (error) {
    console.error('Error al obtener ranking:', error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

// Obtener posición específica de un usuario basado en HistorialPuntaje
const obtenerPosicionUsuario = async (req, res) => {
  try {
    const { id_usuario } = req.params;

    const resultado = await db.query(
      `WITH h AS (
         SELECT id_usuario, puntosmaximos, fecha_actualizacion,
                ROW_NUMBER() OVER (PARTITION BY id_usuario ORDER BY fecha_actualizacion DESC NULLS LAST) rn
         FROM HistorialPuntaje
         WHERE estado = 'A'
       ), ultimo AS (
         SELECT id_usuario, puntosmaximos FROM h WHERE rn = 1
       ), puntos AS (
         SELECT u.id_usuario, u.nombre, u.apellido, COALESCE(ul.puntosmaximos, 0) AS pts
         FROM Usuarios u
         LEFT JOIN ultimo ul ON ul.id_usuario = u.id_usuario
         WHERE u.estado = 'A'
       )
       SELECT 
         p.id_usuario,
         p.nombre,
         p.apellido,
         p.pts AS puntos_acumulados,
         (SELECT COUNT(*) + 1 FROM puntos p2 WHERE p2.pts > p.pts) AS posicion
       FROM puntos p
       WHERE p.id_usuario = $1`,
      [id_usuario]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    res.json({ success: true, data: resultado.rows[0] });

  } catch (error) {
    console.error('Error al obtener posición:', error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

// Actualizar/reconciliar historial de puntajes (histórico):
// Establece puntosmaximos = SUM(puntos_ganados) de Reciclajes 'A'.
// Si no existe historial activo, crea uno; si existe, actualiza el último activo.
const actualizarHistorialPuntaje = async (req, res) => {
  const client = await db.connect();
  try {
    const { id_usuario } = req.body;

    if (!id_usuario) {
      return res.status(400).json({ success: false, message: "ID de usuario requerido" });
    }

    // Verificar usuario activo
    const usr = await client.query(
      `SELECT 1 FROM Usuarios WHERE id_usuario = $1 AND estado = 'A'`,
      [id_usuario]
    );
    if (usr.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    }

    await client.query('BEGIN');

    // Sumar puntos de reciclajes activos
    const suma = await client.query(
      `SELECT COALESCE(SUM(puntos_ganados), 0) AS total
       FROM Reciclajes WHERE id_usuario = $1 AND estado = 'A'`,
      [id_usuario]
    );
    const totalHistorico = parseInt(suma.rows[0].total, 10) || 0;

    // Ver si existe historial activo
    const existe = await client.query(
      `SELECT ctid FROM HistorialPuntaje WHERE id_usuario = $1 AND estado = 'A' ORDER BY fecha_actualizacion DESC NULLS LAST LIMIT 1`,
      [id_usuario]
    );

    let result;
    if (existe.rows.length === 0) {
      result = await client.query(
        `INSERT INTO HistorialPuntaje (id_usuario, puntosmaximos, posicion, estado, fecha_actualizacion)
         VALUES ($1, $2, NULL, 'A', NOW()) RETURNING *`,
        [id_usuario, totalHistorico]
      );
    } else {
      result = await client.query(
        `UPDATE HistorialPuntaje h
         SET puntosmaximos = $2, fecha_actualizacion = NOW()
         WHERE h.ctid = $3
         RETURNING *`,
        [id_usuario, totalHistorico, existe.rows[0].ctid]
      );
    }

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Historial reconciliado correctamente',
      data: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar historial:', error);
    res.status(500).json({ success: false, message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

// Obtener historial de puntajes de un usuario
const obtenerHistorialUsuario = async (req, res) => {
  try {
    const { id_usuario } = req.params;

    const historial = await db.query(
      `SELECT * FROM HistorialPuntaje 
       WHERE id_usuario = $1 AND estado = 'A'
       ORDER BY fecha_actualizacion DESC`,
      [id_usuario]
    );

    res.json({
      success: true,
      data: historial.rows
    });

  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener estadísticas del ranking
const obtenerEstadisticasRanking = async (req, res) => {
  try {
    const estadisticas = await db.query(`
      SELECT 
        COUNT(*) as total_usuarios,
        MAX(puntos_acumulados) as puntos_maximos,
        AVG(puntos_acumulados) as promedio_puntos,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY puntos_acumulados) as mediana_puntos
      FROM Usuarios 
      WHERE estado = 'A' AND puntos_acumulados > 0
    `);

    const topUsuarios = await db.query(`
      SELECT nombre, apellido, puntos_acumulados,
             ROW_NUMBER() OVER (ORDER BY puntos_acumulados DESC) as posicion
      FROM Usuarios 
      WHERE estado = 'A'
      ORDER BY puntos_acumulados DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        estadisticas_generales: estadisticas.rows[0],
        top_10_usuarios: topUsuarios.rows
      }
    });

  } catch (error) {
    console.error('Error al obtener estadísticas del ranking:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

module.exports = {
  obtenerRankingTiendas,
  obtenerRankingUsuarios,
  obtenerPosicionUsuario,
  actualizarHistorialPuntaje,
  obtenerHistorialUsuario,
  obtenerEstadisticasRanking
};