# Password reset flow (Usuarios y Tiendas)

Este backend expone endpoints para que un frontend (por ejemplo, React en Render) maneje restablecimiento de contraseña por token.

## 1) Preparar la base de datos

Ejecuta el SQL en `sql/001_password_reset_tokens.sql` en tu base de datos Postgres:

```
CREATE TABLE IF NOT EXISTS "PasswordResetTokens" (
  token TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('usuario','tienda')),
  id_referencia INTEGER NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passwordresettokens_tipo_idref
  ON "PasswordResetTokens" (tipo, id_referencia);

CREATE INDEX IF NOT EXISTS idx_passwordresettokens_expires_at
  ON "PasswordResetTokens" (expires_at);
```

## 2) Flujo de endpoints

- Solicitar token (desde formulario de email)

  - POST `/api/password/solicitar`
  - Body: `{ "tipo": "usuario" | "tienda", "correo": "email@dominio.com" }`
  - Respuesta contiene `{ token, tipo }` para integrar con tu servicio de correo o construir el enlace temporal.

- Validar token (al abrir el enlace en el frontend)

  - GET `/api/password/validar/:token`
  - Responde si es válido y devuelve `{ tipo, id_referencia }`.

- Confirmar restablecimiento (desde el formulario de nueva contraseña)
  - POST `/api/password/confirmar/:token`
  - Body: `{ "password_nueva": "NuevaClaveSegura123" }`

Notas:

- Por seguridad, `solicitar` responde éxito genérico aunque el correo no exista.
- Los tokens expiran a 1 hora y se marcan como usados al confirmar.

## 3) Ejemplo de integración en React (Render)

- Envío de email: arma un enlace del tipo:
  `https://tu-frontend.onrender.com/reset?token=<TOKEN>&tipo=<usuario|tienda>`

- Pseudocódigo del frontend:

```ts
// Solicitar
await fetch("/api/password/solicitar", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ tipo: "usuario", correo: email }),
});

// Validar (al montar la página /reset)
const r = await fetch(`/api/password/validar/${token}`);
if (r.ok) {
  const { data } = await r.json(); // { tipo, id_referencia }
  // mostrar formulario
}

// Confirmar
await fetch(`/api/password/confirmar/${token}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password_nueva }),
});
```

## 4) Envío de correos desde el backend

Este backend ya envía el correo de restablecimiento usando Nodemailer. Configura estas variables en tu entorno (.env):

```
SMTP_HOST=smtp.tu-proveedor.com
SMTP_PORT=587           # 465 si usas SSL
SMTP_USER=tu_usuario
SMTP_PASS=tu_password
EMAIL_FROM="EcoPoints <no-reply@tu-dominio.com>"
FRONTEND_BASE_URL=https://tu-frontend.onrender.com
```

El enlace enviado será: `${FRONTEND_BASE_URL}/reset?token=...&tipo=usuario|tienda`.

Fallback Gmail: si NO defines SMTP\_\*, se usará `EMAIL_USER` y `EMAIL_PASS` (App Password de Gmail) automáticamente.
Si no configuras ninguna opción, la solicitud seguirá respondiendo de forma genérica pero no se enviará el correo.

## 5) Endpoints de perfil y cambio de contraseña

- Usuarios:

  - GET `/api/usuarios/perfil/:id_usuario`
  - PUT `/api/usuarios/perfil/:id_usuario` (nombre, apellido, documento_tipo, documento_num, correo)
  - PUT `/api/usuarios/:id_usuario/password` (password_actual, password_nueva)

- Tiendas:
  - GET `/api/tiendas/:id_tienda`
  - PUT `/api/tiendas/:id_tienda` (nombre, direccion, correo, municipio, departamento, pais)
  - PUT `/api/tiendas/:id_tienda/password` (password_actual, password_nueva)
