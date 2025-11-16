require("dotenv").config(); //Cargar variables d entorno
const express = require("express"); //Crear servidor web
const http = require('http'); // Para crear el servidor HTTP y acoplar WebSockets
const cors = require("cors"); //Para permitir solicitudes desde otro dominio

const { db, testConnection } = require("./config/db");

// Importar rutas de Waylo únicamente
const wayloAuthRoutes = require("./routes/waylo/authRoutes");
const wayloPerfilGuiaRoutes = require("./routes/waylo/perfilGuiaRoutes");
const wayloPerfilClienteRoutes = require("./routes/waylo/perfilClienteRoutes");
const wayloIdiomaRoutes = require("./routes/waylo/idiomaRoutes");
const wayloDocumentoRoutes = require("./routes/waylo/documentoRoutes");
const wayloDisponibilidadRoutes = require("./routes/waylo/disponibilidadRoutes");
const wayloReservaRoutes = require("./routes/waylo/reservaRoutes");
const wayloTransaccionRoutes = require("./routes/waylo/transaccionRoutes");
const wayloConversacionRoutes = require("./routes/waylo/conversacionRoutes");
const wayloMensajeRoutes = require("./routes/waylo/mensajeRoutes");
const wayloNotificacionRoutes = require("./routes/waylo/notificacionRoutes");
const wayloResenaRoutes = require("./routes/waylo/resenaRoutes");
const wayloConfigRoutes = require("./routes/waylo/configRoutes");
const wayloFavoritoRoutes = require("./routes/waylo/favoritoRoutes");
const wayloMediaRoutes = require("./routes/waylo/mediaRoutes");
const wayloAdminRoutes = require("./routes/waylo/adminRoutes");
const wayloPoliticaRoutes = require("./routes/waylo/politicaRoutes");
const wayloReembolsoRoutes = require("./routes/waylo/reembolsoRoutes");
const wayloFacturaRoutes = require("./routes/waylo/facturaRoutes");
const wayloRespuestaResenaRoutes = require("./routes/waylo/respuestaResenaRoutes");
const wayloHomeRoutes = require("./routes/waylo/homeRoutes");

const app = express(); //Instancia del servidor
const server = http.createServer(app); // Servidor HTTP
const { initSocket } = require('./services/socket');

 //Evitar errores al consumir en Swift iOS y otras aplicaciones
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Permitir solicitudes sin origin (como aplicaciones móviles)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(null, true); // Permitir todos los orígenes por ahora
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json()); //Recibir los datos en JSON

// Probar conexión a la base de datos PostgreSQL
testConnection().then(connected => {
  if (!connected) {
    console.error("⚠️  No se pudo conectar a la base de datos");
    console.error("📋 Verifica:");
    console.error("   - DATABASE_URL en el archivo .env");
    console.error("   - Estado de la base de datos en Render");
    console.error("   - Conectividad de red");
    // No salir inmediatamente, permitir que el servidor inicie
  }
});

// Rutas de Waylo (únicas activas)
app.use("/api/waylo/auth", wayloAuthRoutes);
app.use("/api/waylo/guias", wayloPerfilGuiaRoutes);
app.use("/api/waylo/clientes", wayloPerfilClienteRoutes);
app.use("/api/waylo/idiomas", wayloIdiomaRoutes);
app.use("/api/waylo/documentos", wayloDocumentoRoutes);
app.use("/api/waylo/disponibilidad", wayloDisponibilidadRoutes);
app.use("/api/waylo/reservas", wayloReservaRoutes);
app.use("/api/waylo/transacciones", wayloTransaccionRoutes);
app.use("/api/waylo/conversaciones", wayloConversacionRoutes);
app.use("/api/waylo/mensajes", wayloMensajeRoutes);
app.use("/api/waylo/notificaciones", wayloNotificacionRoutes);
app.use("/api/waylo/resenas", wayloResenaRoutes);
app.use("/api/waylo/config", wayloConfigRoutes);
app.use("/api/waylo/favoritos", wayloFavoritoRoutes);
app.use("/api/waylo/media", wayloMediaRoutes);
app.use("/api/waylo/admin", wayloAdminRoutes);
app.use("/api/waylo/politicas", wayloPoliticaRoutes);
app.use("/api/waylo/reembolsos", wayloReembolsoRoutes);
app.use("/api/waylo/facturas", wayloFacturaRoutes);
app.use("/api/waylo/respuestas", wayloRespuestaResenaRoutes);
app.use("/api/waylo/home", wayloHomeRoutes);

// Ruta de estado de la API
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    message: "API de Waylo funcionando correctamente",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// (ruta de reset eliminada; flujo de Waylo usará endpoints propios si se implementa)

// Iniciar servidor
const PORT = process.env.PORT || 5000;
// Root quick-check route
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Waylo API root - alive', timestamp: new Date().toISOString() });
});

// Global error handlers to help diagnosing crashes in hosted environments
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  // It's safer to exit after an uncaught exception so the process can be restarted by the host
  process.exit(1);
});

// Inicializar WebSocket (Socket.IO)
initSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en el puerto ${PORT}`);
});
