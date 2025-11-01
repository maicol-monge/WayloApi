const express = require("express");
const router = express.Router();
const {
  obtenerRankingTiendas,
  obtenerRankingUsuarios,
  obtenerPosicionUsuario,
  actualizarHistorialPuntaje,
  obtenerHistorialUsuario,
  obtenerEstadisticasRanking
} = require("../controllers/rankingController");

// ======================
// RUTAS DE RANKING
// ======================

// GET /api/ranking - Obtener ranking de usuarios
router.get("/", obtenerRankingUsuarios);

// GET /api/ranking/tiendas - Obtener ranking de tiendas por puntos redimidos
router.get("/tiendas", obtenerRankingTiendas);

// GET /api/ranking/estadisticas - Obtener estadísticas del ranking
router.get("/estadisticas", obtenerEstadisticasRanking);

// GET /api/ranking/usuario/:id_usuario - Obtener posición de usuario
router.get("/usuario/:id_usuario", obtenerPosicionUsuario);

// GET /api/ranking/historial/:id_usuario - Obtener historial de usuario
router.get("/historial/:id_usuario", obtenerHistorialUsuario);

// POST /api/ranking/actualizar - Actualizar historial de puntaje
router.post("/actualizar", actualizarHistorialPuntaje);

module.exports = router;