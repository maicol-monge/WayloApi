const express = require("express");
const router = express.Router();
const {
  crearObjeto,
  obtenerObjetos,
  obtenerObjetoPorId,
  actualizarObjeto,
  eliminarObjeto,
  calcularPuntos
} = require("../controllers/objetoController");

// ======================
// RUTAS DE OBJETOS
// ======================

// POST /api/objetos - Crear nuevo objeto reciclable
router.post("/", crearObjeto);

// GET /api/objetos - Obtener todos los objetos
router.get("/", obtenerObjetos);

// POST /api/objetos/calcular-puntos - Calcular puntos por peso
router.post("/calcular-puntos", calcularPuntos);

// GET /api/objetos/:id_objeto - Obtener objeto por ID
router.get("/:id_objeto", obtenerObjetoPorId);

// PUT /api/objetos/:id_objeto - Actualizar objeto
router.put("/:id_objeto", actualizarObjeto);

// DELETE /api/objetos/:id_objeto - Eliminar objeto
router.delete("/:id_objeto", eliminarObjeto);

module.exports = router;