# Waylo API

API REST para la aplicación móvil Waylo: conecta turistas con guías locales. Incluye autenticación, perfiles, disponibilidad, reservas, pagos (modelo), chat, notificaciones, reseñas y favoritos.

## Inicio rápido

1. Variables de entorno mínimas:

```env
DATABASE_URL=postgresql://usuario:contraseña@host:5432/basededatos
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=5000
```

2. Instalar y correr

```bash
npm install
npm start
```

## Endpoints

El detalle completo está en `docs/waylo-api.md`. Base path: `/api/waylo`.

Secciones principales:

- Auth (`/auth`): registro cliente/guía, login
- Perfiles (`/guias`, `/clientes`)
- Idiomas (`/idiomas`)
- Documentos (`/documentos`)
- Media (`/media`): subidas a carpetas `fotos`, `foto-perfil` y galería de guías
- Disponibilidad (`/disponibilidad`)
- Reservas (`/reservas`) y Transacciones (`/transacciones`)
- Chat (`/conversaciones`, `/mensajes`)
- Notificaciones (`/notificaciones`)
- Reseñas (`/resenas`)
- Configuración (`/config`)
- Favoritos (`/favoritos`)

## Storage (Supabase)

Bucket: `waylo_images` con carpetas:

- `fotos` (imágenes generales)
- `foto-perfil` (avatars de guía/cliente)
- `documentos` (verificación de guías; admite PDF)
