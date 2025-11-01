require("dotenv").config(); //Cargar variables d entorno
const express = require("express"); //Crear servidor web
const cors = require("cors"); //Para permitir solicitudes desde otro dominio

const { db, testConnection } = require("./config/db");

// Importar todas las rutas
const usuarioRoutes = require("./routes/usuarioRoutes");
const tiendaRoutes = require("./routes/tiendaRoutes");
const productoRoutes = require("./routes/productoRoutes");
const reciclajeRoutes = require("./routes/reciclajeRoutes");
const canjeRoutes = require("./routes/canjeRoutes");
const objetoRoutes = require("./routes/objetoRoutes");
const rankingRoutes = require("./routes/rankingRoutes");
const imagenRoutes = require("./routes/imagenRoutes");
const passwordResetRoutes = require("./routes/passwordResetRoutes");

const app = express(); //Instancia del servidor

 //Evitar errores al consumir en Swift iOS y otras aplicaciones
const allowedOrigins = [
  'https://controlcitas-frontend-production.up.railway.app',
  'http://localhost:5173', // desarrollo web
  'http://localhost:3000', // desarrollo web alternativo
  'https://ecopointspasswordreset.onrender.com', // frontend de reset en Render
  // Agregar aquí otros orígenes según sea necesario
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

// Rutas de la API de Reciclaje (ANTES de app.listen)
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/tiendas", tiendaRoutes);
app.use("/api/productos", productoRoutes);
app.use("/api/reciclajes", reciclajeRoutes);
app.use("/api/canjes", canjeRoutes);
app.use("/api/objetos", objetoRoutes);
app.use("/api/ranking", rankingRoutes);
app.use("/api/imagenes", imagenRoutes);
app.use("/api/password", passwordResetRoutes);

// Ruta de estado de la API
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    message: "API de EcoPoints funcionando correctamente",
    timestamp: new Date().toISOString(),
    version: "1.0.0"
  });
});

// Página mínima de restablecimiento (fallback) - útil si el frontend no está desplegado
app.get('/reset', (req, res) => {
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <title>Restablecer contraseña - EcoPoints (fallback)</title>
      <style>body{font-family:Arial,Helvetica,sans-serif;padding:20px;max-width:700px;margin:0 auto}label{display:block;margin-top:12px}input{width:100%;padding:8px;margin-top:6px}button{margin-top:12px;padding:10px 14px}</style>
    </head>
    <body>
      <h1>Restablecer contraseña</h1>
      <p>Si llegaste aquí desde un correo, el token está en la URL. Ej: <code>?token=....&tipo=usuario</code></p>
      <div id="message" style="color:#b00"></div>
      <form id="resetForm">
        <label>Nueva contraseña
          <input id="password" type="password" required minlength="8" />
        </label>
        <label>Confirmar contraseña
          <input id="password2" type="password" required minlength="8" />
        </label>
        <button type="submit">Actualizar contraseña</button>
      </form>

      <script>
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        const tipo = params.get('tipo');
        const msg = document.getElementById('message');
        const form = document.getElementById('resetForm');
        if (!token) {
          msg.textContent = 'Token no encontrado en la URL. Asegúrate de abrir el enlace desde el correo.';
          form.style.display = 'none';
        }

        // Optional: validate token with backend
        async function validar() {
          try {
            const r = await fetch('/api/password/validar/' + encodeURIComponent(token));
            if (!r.ok) {
              const body = await r.json().catch(()=>null);
              msg.textContent = 'Token inválido o expirado: ' + (body && body.message ? body.message : r.statusText);
              form.style.display = 'none';
            } else {
              const data = await r.json();
              msg.style.color = '#080';
              msg.textContent = 'Token válido para tipo: ' + (data.data && data.data.tipo ? data.data.tipo : tipo);
            }
          } catch(e) {
            msg.textContent = 'Error validando token: ' + e.message;
            form.style.display = 'none';
          }
        }

        if (token) validar();

        form.addEventListener('submit', async (ev)=>{
          ev.preventDefault();
          msg.style.color = '#b00';
          msg.textContent = '';
          const p1 = document.getElementById('password').value;
          const p2 = document.getElementById('password2').value;
          if (p1 !== p2) { msg.textContent = 'Las contraseñas no coinciden'; return; }
          try {
            const r = await fetch('/api/password/confirmar/' + encodeURIComponent(token), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password_nueva: p1 })
            });
            const body = await r.json().catch(()=>null);
            if (!r.ok) {
              msg.textContent = 'Error: ' + (body && body.message ? body.message : r.statusText);
            } else {
              msg.style.color = '#080';
              msg.textContent = (body && body.message) ? body.message : 'Contraseña actualizada correctamente';
              form.reset();
            }
          } catch(e) {
            msg.textContent = 'Error al actualizar contraseña: ' + e.message;
          }
        });
      </script>
    </body>
  </html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;
// Root quick-check route
app.get('/', (req, res) => {
  res.json({ success: true, message: 'EcoPoints API root - alive', timestamp: new Date().toISOString() });
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

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend corriendo en el puerto ${PORT}`);
});
