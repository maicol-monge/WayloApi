# Solución al Error HTTP 500 al Aprobar Guías

## Problema Identificado

Al intentar aprobar un guía en el panel de administración, se generaba un error HTTP 500:

```
Error verifying guia: Error: HTTP 500
```

### Causa del Error

La tabla `documentos_guia` en la base de datos no tiene las columnas necesarias que el código del controlador administrativo intenta usar:

- `estado` (VARCHAR) - para indicar si el documento está pendiente, aprobado o rechazado
- `reviewed_by` (INTEGER) - ID del administrador que revisó el documento
- `reviewed_at` (TIMESTAMP) - fecha y hora de la revisión
- `created_at` (TIMESTAMP) - fecha de creación del documento

## Solución

### Opción 1: Ejecutar la Migración SQL (RECOMENDADO)

1. Conectarte a tu base de datos PostgreSQL
2. Ejecutar el script SQL ubicado en: `WayloApi/sql/add_documentos_guia_columns.sql`

Puedes ejecutarlo de varias formas:

**Usando psql:**

```bash
psql -U tu_usuario -d nombre_base_datos -f sql/add_documentos_guia_columns.sql
```

**Usando un cliente GUI como pgAdmin o DBeaver:**

- Abre el archivo SQL
- Ejecuta el script completo

**Desde node.js (una sola vez):**

```javascript
const { db } = require("./config/db");
const fs = require("fs");

async function runMigration() {
  const sql = fs.readFileSync("./sql/add_documentos_guia_columns.sql", "utf8");
  await db.query(sql);
  console.log("Migration completed successfully");
}

runMigration().catch(console.error);
```

### Opción 2: Manejo Temporal de Errores

He modificado el código en `controllers/waylo/admin/guiaAdminController.js` para que:

1. **setVerification()**: Maneja los errores al actualizar documentos sin romper la aprobación del guía
2. **listDocumentos()**: Devuelve todos los documentos si la columna `estado` no existe
3. **setDocumentoEstado()**: Devuelve un mensaje de error informativo si las columnas no existen

Con estos cambios, **la aprobación de guías funcionará** aunque no hayas ejecutado la migración, pero:

- No se actualizarán automáticamente los estados de los documentos asociados
- La gestión de documentos individuales no funcionará completamente

## Verificación

Para verificar que el problema está resuelto:

1. Reinicia el servidor de la API
2. Intenta aprobar un guía desde el panel de administración
3. No deberías ver el error HTTP 500

## Mejora Futura

Considera implementar un sistema de migraciones con herramientas como:

- [node-pg-migrate](https://www.npmjs.com/package/node-pg-migrate)
- [db-migrate](https://www.npmjs.com/package/db-migrate)
- [Knex.js](https://knexjs.org/)

Esto te permitirá versionar y gestionar cambios en la base de datos de forma más ordenada.
