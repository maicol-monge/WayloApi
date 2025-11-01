const { db } = require("../config/db");

// ======================
// OBJETOS - Controladores
// ======================

// Crear objeto reciclable
const crearObjeto = async (req, res) => {
  try {
    const { nombre, descripcion, valor_por_peso } = req.body;

    if (!nombre || !valor_por_peso) {
      return res.status(400).json({ 
        success: false, 
        message: "Nombre y valor por peso son requeridos" 
      });
    }

    // Insertar objeto
    const resultado = await db.query(
      `INSERT INTO Objetos 
       (nombre, descripcion, valor_por_peso, estado) 
       VALUES ($1, $2, $3, 'A') 
       RETURNING *`,
      [nombre, descripcion, valor_por_peso]
    );

    res.status(201).json({
      success: true,
      message: "Objeto creado exitosamente",
      data: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al crear objeto:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener todos los objetos reciclables
const obtenerObjetos = async (req, res) => {
  try {
    const objetos = await db.query(
      `SELECT * FROM Objetos 
       WHERE estado = 'A' 
       ORDER BY nombre`
    );

    res.json({
      success: true,
      data: objetos.rows
    });

  } catch (error) {
    console.error('Error al obtener objetos:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Obtener objeto por ID
const obtenerObjetoPorId = async (req, res) => {
  try {
    const { id_objeto } = req.params;

    const objeto = await db.query(
      'SELECT * FROM Objetos WHERE id_objeto = $1 AND estado = $2',
      [id_objeto, 'A']
    );

    if (objeto.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Objeto no encontrado" 
      });
    }

    res.json({
      success: true,
      data: objeto.rows[0]
    });

  } catch (error) {
    console.error('Error al obtener objeto:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Actualizar objeto
const actualizarObjeto = async (req, res) => {
  try {
    const { id_objeto } = req.params;
    const { nombre, descripcion, valor_por_peso } = req.body;

    if (!nombre || !valor_por_peso) {
      return res.status(400).json({ 
        success: false, 
        message: "Nombre y valor por peso son requeridos" 
      });
    }

    const resultado = await db.query(
      `UPDATE Objetos 
       SET nombre = $1, descripcion = $2, valor_por_peso = $3
       WHERE id_objeto = $4 AND estado = 'A'
       RETURNING *`,
      [nombre, descripcion, valor_por_peso, id_objeto]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Objeto no encontrado" 
      });
    }

    res.json({
      success: true,
      message: "Objeto actualizado exitosamente",
      data: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al actualizar objeto:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Eliminar objeto (cambiar estado)
const eliminarObjeto = async (req, res) => {
  try {
    const { id_objeto } = req.params;

    const resultado = await db.query(
      `UPDATE Objetos 
       SET estado = 'I'
       WHERE id_objeto = $1 AND estado = 'A'
       RETURNING id_objeto, nombre`,
      [id_objeto]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Objeto no encontrado" 
      });
    }

    res.json({
      success: true,
      message: "Objeto eliminado exitosamente",
      data: resultado.rows[0]
    });

  } catch (error) {
    console.error('Error al eliminar objeto:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

// Calcular puntos por peso y objeto
const calcularPuntos = async (req, res) => {
  try {
    const { id_objeto, peso } = req.body;

    if (!id_objeto || !peso) {
      return res.status(400).json({ 
        success: false, 
        message: "ID del objeto y peso son requeridos" 
      });
    }

    const objeto = await db.query(
      'SELECT * FROM Objetos WHERE id_objeto = $1 AND estado = $2',
      [id_objeto, 'A']
    );

    if (objeto.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: "Objeto no encontrado" 
      });
    }

    const puntos_estimados = Math.floor(peso * objeto.rows[0].valor_por_peso);

    res.json({
      success: true,
      data: {
        objeto: objeto.rows[0],
        peso: peso,
        puntos_estimados: puntos_estimados
      }
    });

  } catch (error) {
    console.error('Error al calcular puntos:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error interno del servidor" 
    });
  }
};

module.exports = {
  crearObjeto,
  obtenerObjetos,
  obtenerObjetoPorId,
  actualizarObjeto,
  eliminarObjeto,
  calcularPuntos
};