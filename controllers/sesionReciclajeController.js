const { db } = require("../config/db");

// ======================
// SESIONES DE RECICLAJE (QR)
// ======================

// Crear sesión de reciclaje (la TIENDA genera el QR)
// Body: { id_tienda, id_objeto, peso_medido }
const crearSesionReciclaje = async (req, res) => {
  try {
    const { id_tienda, id_objeto, peso_medido } = req.body;

    if (!id_tienda || !id_objeto || peso_medido === undefined) {
      return res.status(400).json({
        success: false,
        message: "id_tienda, id_objeto y peso_medido son requeridos",
      });
    }

    const peso = parseFloat(peso_medido);
    if (isNaN(peso) || peso <= 0) {
      return res.status(400).json({ success: false, message: "peso_medido inválido" });
    }

    // Validar tienda activa
    const tienda = await db.query(
      "SELECT id_tienda FROM Tienda WHERE id_tienda = $1 AND estado = 'A'",
      [id_tienda]
    );
    if (tienda.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Tienda no encontrada" });
    }

    // Validar objeto activo
    const objeto = await db.query(
      "SELECT id_objeto FROM Objetos WHERE id_objeto = $1 AND estado = 'A'",
      [id_objeto]
    );
    if (objeto.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Objeto no encontrado" });
    }

    // Crear sesión (estado PENDIENTE por defecto, id UUID por defecto)
    const sesion = await db.query(
      `INSERT INTO ReciclajeSesiones (id_tienda, id_objeto, peso_medido)
       VALUES ($1, $2, $3)
       RETURNING id as sesion_id, created_at, expires_at, estado`,
      [id_tienda, id_objeto, peso]
    );

    return res.status(201).json({
      success: true,
      message: "Sesión de reciclaje creada",
      data: sesion.rows[0],
    });
  } catch (error) {
    console.error("Error al crear sesión de reciclaje:", error);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

// Confirmar sesión (el USUARIO escanea el QR y confirma)
// Params: :id (sesion_id)
// Body: { id_usuario, id_objeto_usuario, peso_usuario, id_tienda (opcional) }
const confirmarSesionReciclaje = async (req, res) => {
  const client = await db.connect();
  try {
    const { id } = req.params; // sesion_id (UUID)
    const { id_usuario, id_objeto_usuario, peso_usuario, id_tienda } = req.body;

    if (!id || !id_usuario || !id_objeto_usuario || peso_usuario === undefined) {
      return res.status(400).json({
        success: false,
        message: "sesion_id, id_usuario, id_objeto_usuario y peso_usuario son requeridos",
      });
    }

    const pesoU = parseFloat(peso_usuario);
    if (isNaN(pesoU) || pesoU <= 0) {
      return res.status(400).json({ success: false, message: "peso_usuario inválido" });
    }

    await client.query("BEGIN");

    // Bloquear la sesión para evitar condiciones de carrera
    const sesion = await client.query(
      `SELECT * FROM ReciclajeSesiones WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (sesion.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Sesión no encontrada" });
    }

    const s = sesion.rows[0];

    if (s.estado !== "PENDIENTE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Sesión no disponible" });
    }

    // Verificar expiración
    const expirada = await client.query(`SELECT NOW() > $1 as exp`, [s.expires_at]);
    if (expirada.rows[0].exp) {
      await client.query(
        `UPDATE ReciclajeSesiones SET estado = 'EXPIRADA' WHERE id = $1`,
        [id]
      );
      await client.query("COMMIT");
      return res.status(400).json({ success: false, message: "Sesión expirada" });
    }

    // Validaciones de coincidencia
    if (id_tienda && parseInt(id_tienda, 10) !== s.id_tienda) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "id_tienda no coincide" });
    }

    if (parseInt(id_objeto_usuario, 10) !== s.id_objeto) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "id_objeto no coincide" });
    }

    if (Math.abs(pesoU - parseFloat(s.peso_medido)) > 0) { // match exacto por ahora
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "peso no coincide" });
    }

    // Obtener valor_por_peso
    const objeto = await client.query(
      `SELECT valor_por_peso, nombre FROM Objetos WHERE id_objeto = $1 AND estado = 'A'`,
      [s.id_objeto]
    );
    if (objeto.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Objeto no disponible" });
    }

    const puntos = Math.floor(parseFloat(s.peso_medido) * objeto.rows[0].valor_por_peso);

    // Insertar reciclaje
    const reciclaje = await client.query(
      `INSERT INTO Reciclajes (id_usuario, id_tienda, id_objeto, peso, puntos_ganados, codigo_qr, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'A')
       RETURNING *`,
      [id_usuario, s.id_tienda, s.id_objeto, s.peso_medido, puntos, id]
    );

    // Actualizar puntos del usuario
    await client.query(
      `UPDATE Usuarios SET puntos_acumulados = puntos_acumulados + $1 WHERE id_usuario = $2`,
      [puntos, id_usuario]
    );

    // HistorialPuntaje: crear si es el primer reciclaje del usuario;
    // si ya existe, solo incrementar puntosmaximos por los puntos ganados en este reciclaje.
    const existeHist = await client.query(
      `SELECT 1 FROM HistorialPuntaje WHERE id_usuario = $1 AND estado = 'A' LIMIT 1`,
      [id_usuario]
    );

    if (existeHist.rows.length === 0) {
      await client.query(
        `INSERT INTO HistorialPuntaje (id_usuario, puntosmaximos, posicion, estado, fecha_actualizacion)
         VALUES ($1, $2, NULL, 'A', NOW())`,
        [id_usuario, puntos]
      );
    } else {
      await client.query(
        `UPDATE HistorialPuntaje h
         SET puntosmaximos = h.puntosmaximos + $2, fecha_actualizacion = NOW()
         WHERE h.ctid = (
           SELECT ctid FROM HistorialPuntaje
           WHERE id_usuario = $1 AND estado = 'A'
           ORDER BY fecha_actualizacion DESC NULLS LAST
           LIMIT 1
         )`,
        [id_usuario, puntos]
      );
    }

    // Marcar sesión como confirmada
    await client.query(
      `UPDATE ReciclajeSesiones SET estado = 'CONFIRMADA', confirmado_por = $2, confirmado_en = NOW() WHERE id = $1`,
      [id, id_usuario]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Reciclaje confirmado",
      data: {
        ...reciclaje.rows[0],
        puntos_ganados: puntos,
        objeto_nombre: objeto.rows[0].nombre,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error al confirmar sesión de reciclaje:", error);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

module.exports = {
  crearSesionReciclaje,
  confirmarSesionReciclaje,
};
