# Códigos de Validación de Autenticación

## Descripción General

Se han implementado validaciones adicionales en el proceso de autenticación para asegurar que solo usuarios autorizados puedan acceder a la aplicación.

## Validaciones Implementadas

### 1. Usuario Regular (App Waylo)

**Endpoint:** `POST /api/waylo/auth/login`

#### Validaciones:

1. **Estado de cuenta activo**: El usuario debe tener `estado = 'A'`
2. **Verificación de guía** (solo para rol guía): El perfil del guía debe estar aprobado (`verificacion_estado = 'aprobado'`)

#### Códigos de Error:

| Código                  | HTTP Status | Mensaje                                                                                 | Descripción                                                             |
| ----------------------- | ----------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `ACCOUNT_INACTIVE`      | 403         | "Tu cuenta ha sido desactivada. Por favor contacta con el administrador."               | El usuario existe pero su cuenta está inactiva (`estado != 'A'`)        |
| `VERIFICATION_PENDING`  | 403         | "Tu cuenta está pendiente de verificación. Recibirás un correo cuando sea aprobada."    | El guía no ha sido verificado aún (`verificacion_estado = 'pendiente'`) |
| `VERIFICATION_REJECTED` | 403         | "Tu verificación como guía ha sido rechazada. Por favor contacta con el administrador." | El guía fue rechazado (`verificacion_estado = 'rechazado'`)             |

### 2. Administrador (Panel Admin)

**Endpoint:** `POST /api/waylo/admin/login`

#### Validaciones:

1. **Estado de cuenta activo**: El admin debe tener `estado = 'A'`
2. **Rol de administrador**: El usuario debe tener rol 'admin'

#### Códigos de Error:

| Código             | HTTP Status | Mensaje                                                                                | Descripción                                          |
| ------------------ | ----------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `ACCOUNT_INACTIVE` | 403         | "Tu cuenta de administrador ha sido desactivada. Contacta con el super administrador." | El administrador existe pero su cuenta está inactiva |

## Ejemplos de Respuesta

### Usuario Inactivo (Cliente/Guía)

```json
{
  "success": false,
  "message": "Tu cuenta ha sido desactivada. Por favor contacta con el administrador.",
  "code": "ACCOUNT_INACTIVE"
}
```

### Guía Pendiente de Verificación

```json
{
  "success": false,
  "message": "Tu cuenta está pendiente de verificación. Recibirás un correo cuando sea aprobada.",
  "code": "VERIFICATION_PENDING"
}
```

### Guía Rechazado

```json
{
  "success": false,
  "message": "Tu verificación como guía ha sido rechazada. Por favor contacta con el administrador.",
  "code": "VERIFICATION_REJECTED"
}
```

### Admin Inactivo

```json
{
  "success": false,
  "message": "Tu cuenta de administrador ha sido desactivada. Contacta con el super administrador.",
  "code": "ACCOUNT_INACTIVE"
}
```

## Flujo de Verificación de Guías

```
┌─────────────────────┐
│  Guía se registra   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ verificacion_estado │
│   = 'pendiente'     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ❌ No puede hacer   │
│    login            │
│ Mensaje: Pendiente  │
└─────────────────────┘

           │
           ▼ (Admin aprueba)

┌─────────────────────┐
│ verificacion_estado │
│   = 'aprobado'      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ✅ Puede hacer      │
│    login            │
└─────────────────────┘

           │
           ▼ (Admin rechaza)

┌─────────────────────┐
│ verificacion_estado │
│   = 'rechazado'     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ ❌ No puede hacer   │
│    login            │
│ Mensaje: Rechazado  │
└─────────────────────┘
```

## Recomendaciones para el Frontend

### Manejo de Errores en React/Vue

```javascript
async function handleLogin(email, password) {
  try {
    const response = await fetch("/api/waylo/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, contrasena: password }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Manejar diferentes códigos de error
      switch (data.code) {
        case "ACCOUNT_INACTIVE":
          showError("Tu cuenta está inactiva. Contacta al administrador.");
          break;
        case "VERIFICATION_PENDING":
          showWarning(
            "Tu cuenta está pendiente de verificación. Te notificaremos por email."
          );
          break;
        case "VERIFICATION_REJECTED":
          showError(
            "Tu verificación fue rechazada. Contacta al administrador."
          );
          break;
        default:
          showError(data.message || "Error al iniciar sesión");
      }
      return;
    }

    // Login exitoso
    saveToken(data.token);
    redirectToDashboard();
  } catch (error) {
    showError("Error de conexión. Intenta nuevamente.");
  }
}
```

## Seguridad

- ✅ Las contraseñas se validan con bcrypt
- ✅ Los intentos de login fallidos se registran
- ✅ Se bloquea temporalmente después de 5 intentos fallidos
- ✅ Los tokens JWT tienen expiración de 8 horas
- ✅ Solo usuarios activos pueden autenticarse
- ✅ Los guías deben estar verificados antes de acceder

## Notas Adicionales

1. **Clientes**: No requieren verificación adicional, solo estado activo
2. **Guías**: Requieren estado activo + verificación aprobada
3. **Admins**: Requieren estado activo + rol admin

## Testing

### Casos de Prueba

1. **Login exitoso - Cliente activo**
   - Estado: 'A'
   - Resultado: ✅ Acceso permitido

2. **Login fallido - Cliente inactivo**
   - Estado: 'I'
   - Resultado: ❌ ACCOUNT_INACTIVE

3. **Login exitoso - Guía aprobado**
   - Estado: 'A' + verificacion_estado: 'aprobado'
   - Resultado: ✅ Acceso permitido

4. **Login fallido - Guía pendiente**
   - Estado: 'A' + verificacion_estado: 'pendiente'
   - Resultado: ❌ VERIFICATION_PENDING

5. **Login fallido - Guía rechazado**
   - Estado: 'A' + verificacion_estado: 'rechazado'
   - Resultado: ❌ VERIFICATION_REJECTED

6. **Login exitoso - Admin activo**
   - Estado: 'A' + rol: 'admin'
   - Resultado: ✅ Acceso permitido

7. **Login fallido - Admin inactivo**
   - Estado: 'I' + rol: 'admin'
   - Resultado: ❌ ACCOUNT_INACTIVE
