# WayloApi — Guía rápida de configuración para desarrollo

Este documento explica cómo preparar, configurar e iniciar el backend (WayloApi) en macOS (zsh). Incluye pasos mínimos para ejecutar la API localmente y los valores de entorno importantes.

Requisitos
- Node.js 18+ (recomendado): https://nodejs.org/
- npm (v9+) o yarn
- PostgreSQL accesible (local o en la nube, p.ej. Render, Supabase, Heroku)
- Opcional: cuenta SendGrid / Resend o SMTP para envíos de correo

1) Clonar y entrar al directorio

```bash
cd ~/Documents/WayloApi
```

2) Instalar dependencias

```bash
npm install
# o si prefieres yarn
# yarn install
```

3) Variables de entorno
Crea un archivo `.env` en la raíz con al menos las siguientes variables (ejemplo):

```
PORT=5000
DATABASE_URL=postgresql://user:password@host:5432/dbname
# Opciones de email (elige una):
# Usar SendGrid
SENDGRID_API_KEY=SG.xxxxx
SENDGRID_FROM="Waylo <no-reply@yourdomain.com>"
# o usar Resend
RESEND_API_KEY=re_XXXXXXXX
RESEND_FROM="Waylo <no-reply@yourdomain.com>"
# o SMTP directo
SMTP_HOST=smtp.mailprovider.com
SMTP_PORT=587
SMTP_USER=smtp-user
SMTP_PASS=smtp-pass
EMAIL_FROM="Waylo <no-reply@yourdomain.com>"

# URL del frontend para los links de recuperación
FRONTEND_BASE_URL=https://waylopasswordreset.example.com

# Desarrollo / debug
DEBUG_EMAIL=true
SKIP_EMAIL_SEND=false
```

Notas:
- `DATABASE_URL` es obligatorio y debe apuntar a una base PostgreSQL. El `config/db.js` utiliza esta variable.
- El servicio de correos puede configurarse vía SendGrid, Resend o SMTP. Si no se configura correctamente, el envío de correos fallará.

4) Probar conexión a la base de datos

```bash
node -e "require('./config/db').testConnection().then(console.log).catch(console.error)"
```

5) Ejecutar la API en desarrollo

```bash
npm run dev
# o
node server.js
```

El servidor levantará en `PORT` (por defecto 5000). Puedes comprobar `GET /api/status`.

6) Migraciones / esquema de base de datos
En el directorio `sql/` hay un `bd.sql` con un volcado inicial. Para crear la base de datos localmente, ejecútalo en tu Postgres:

```bash
psql $DATABASE_URL -f sql/bd.sql
```

Ajusta según tu entorno.

7) Websockets
El servidor inicializa Socket.IO desde `services/socket.js`. Para usarlo en el cliente, instala el cliente Socket.IO y configura la URL del backend.

8) Despliegue (básico)
- En Render/Heroku: configura las variables de entorno y sube el repositorio.
- Asegúrate de que `DATABASE_URL` y las credenciales de correo estén configuradas en el entorno de producción.

9) Logs y debugging
- `DEBUG_EMAIL=true` activa más verbose en emailService.
- `testConnection()` se ejecuta en arranque para avisar si la DB no responde.

Problemas comunes
- Error de conexión a PostgreSQL: revisa `DATABASE_URL` y reglas de firewall.
- Fallo envío de correos: revisa `SENDGRID_API_KEY` / `RESEND_API_KEY` o credenciales SMTP.
- Puerto en uso: cambia `PORT`.

Contacto
- Revisa `controllers/waylo/passwordResetController.js` y `services/emailService.js` para entender la lógica de envío de emails y token reset.

---

Este README pretende ser un checklist mínimo para arrancar el backend localmente. Si quieres puedo generar un script `docker-compose` o un `Makefile` para automatizar estos pasos.