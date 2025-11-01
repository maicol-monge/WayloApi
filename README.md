# EcoPoints API - Documentación

## Descripción

API REST para la aplicación móvil EcoPoints de reciclaje. Permite gestionar usuarios, tiendas, productos, reciclajes, canjes y rankings.

## Configuración de Base de Datos

La API utiliza PostgreSQL con el esquema `reciclaje`.

## Endpoints de la API

### 🔐 Usuarios

| Método | Endpoint                               | Descripción                         |
| ------ | -------------------------------------- | ----------------------------------- |
| POST   | `/api/usuarios/registro`               | Registrar nuevo usuario             |
| POST   | `/api/usuarios/login`                  | Login de usuario                    |
| GET    | `/api/usuarios/perfil/:id_usuario`     | Obtener perfil de usuario           |
| GET    | `/api/usuarios/:id_usuario/reciclajes` | Historial de reciclajes del usuario |
| GET    | `/api/usuarios/:id_usuario/canjes`     | Historial de canjes del usuario     |

### 🏪 Tiendas

| Método | Endpoint                            | Descripción               |
| ------ | ----------------------------------- | ------------------------- |
| POST   | `/api/tiendas/registro`             | Registrar nueva tienda    |
| POST   | `/api/tiendas/login`                | Login de tienda           |
| GET    | `/api/tiendas`                      | Obtener todas las tiendas |
| GET    | `/api/tiendas/:id_tienda`           | Obtener tienda por ID     |
| GET    | `/api/tiendas/:id_tienda/productos` | Productos de una tienda   |

### 📦 Productos

| Método | Endpoint                          | Descripción                 |
| ------ | --------------------------------- | --------------------------- |
| POST   | `/api/productos`                  | Crear nuevo producto        |
| GET    | `/api/productos`                  | Obtener todos los productos |
| GET    | `/api/productos/buscar?q=termino` | Buscar productos            |
| GET    | `/api/productos/:id_producto`     | Obtener producto por ID     |

### ♻️ Reciclajes

| Método | Endpoint                              | Descripción               |
| ------ | ------------------------------------- | ------------------------- |
| POST   | `/api/reciclajes`                     | Registrar nuevo reciclaje |
| GET    | `/api/reciclajes/usuario/:id_usuario` | Reciclajes por usuario    |
| GET    | `/api/reciclajes/tienda/:id_tienda`   | Reciclajes por tienda     |
| GET    | `/api/reciclajes/estadisticas`        | Estadísticas generales    |

### 🎁 Canjes

| Método | Endpoint                          | Descripción                       |
| ------ | --------------------------------- | --------------------------------- |
| POST   | `/api/canjes`                     | Realizar nuevo canje              |
| POST   | `/api/canjes/verificar`           | Verificar disponibilidad de canje |
| GET    | `/api/canjes/usuario/:id_usuario` | Canjes por usuario                |
| GET    | `/api/canjes/tienda/:id_tienda`   | Canjes por tienda                 |

### 🗑️ Objetos Reciclables

| Método | Endpoint                       | Descripción                   |
| ------ | ------------------------------ | ----------------------------- |
| POST   | `/api/objetos`                 | Crear nuevo objeto reciclable |
| GET    | `/api/objetos`                 | Obtener todos los objetos     |
| POST   | `/api/objetos/calcular-puntos` | Calcular puntos por peso      |
| GET    | `/api/objetos/:id_objeto`      | Obtener objeto por ID         |
| PUT    | `/api/objetos/:id_objeto`      | Actualizar objeto             |
| DELETE | `/api/objetos/:id_objeto`      | Eliminar objeto               |

### 🏆 Ranking

| Método | Endpoint                             | Descripción                 |
| ------ | ------------------------------------ | --------------------------- |
| GET    | `/api/ranking`                       | Obtener ranking de usuarios |
| GET    | `/api/ranking/estadisticas`          | Estadísticas del ranking    |
| GET    | `/api/ranking/usuario/:id_usuario`   | Posición de usuario         |
| GET    | `/api/ranking/historial/:id_usuario` | Historial de usuario        |
| POST   | `/api/ranking/actualizar`            | Actualizar historial        |

### ⚙️ Sistema

| Método | Endpoint      | Descripción      |
| ------ | ------------- | ---------------- |
| GET    | `/api/status` | Estado de la API |

## Ejemplos de Uso para Swift

### 1. Registro de Usuario

```swift
let url = URL(string: "https://tu-api.com/api/usuarios/registro")!
let parameters = [
    "nombre": "Juan",
    "apellido": "Pérez",
    "documento_tipo": "Cédula",
    "documento_num": "123456789",
    "correo": "juan@email.com",
    "password": "123456"
]
```

### 2. Login de Usuario

```swift
let url = URL(string: "https://tu-api.com/api/usuarios/login")!
let parameters = [
    "documento_num": "123456789",
    "password": "123456"
]
```

### 3. Registrar Reciclaje

```swift
let url = URL(string: "https://tu-api.com/api/reciclajes")!
let parameters = [
    "id_usuario": 1,
    "id_tienda": 1,
    "id_objeto": 1,
    "peso": 2.5,
    "codigo_qr": "QR123456"
]
```

### 4. Realizar Canje

```swift
let url = URL(string: "https://tu-api.com/api/canjes")!
let parameters = [
    "id_usuario": 1,
    "id_producto": 1
]
```

## Estructura de Respuestas

### Respuesta Exitosa

```json
{
  "success": true,
  "message": "Operación exitosa",
  "data": {
    /* datos solicitados */
  }
}
```

### Respuesta de Error

```json
{
  "success": false,
  "message": "Descripción del error"
}
```

## Variables de Entorno Requeridas

```env
DATABASE_URL=postgresql://usuario:contraseña@host/basededatos
PORT=5000
NODE_ENV=production
EMAIL_USER=tu@email.com
EMAIL_PASS=tu_contraseña
```

## Instalación y Ejecución

```bash
npm install
npm start
```

## Base de Datos

La aplicación requiere PostgreSQL con las siguientes tablas:

- Usuarios
- Tienda
- Productos
- Objetos
- Reciclajes
- Canjes
- HistorialPuntaje
