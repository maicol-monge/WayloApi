const { Pool } = require("pg");

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10, // máximo número de conexiones
  min: 2,  // mínimo número de conexiones
});

// Manejar eventos de conexión
db.on('connect', (client) => {
  console.log('✅ Nueva conexión establecida a PostgreSQL');
});

db.on('error', (err) => {
  console.error('❌ Error en la base de datos PostgreSQL:', err);
});

// Función para probar la conexión
const testConnection = async () => {
  try {
    const client = await db.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Conectado a la base de datos PostgreSQL');
    console.log('🕐 Tiempo del servidor:', result.rows[0].now);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
    return false;
  }
};

module.exports = { db, testConnection };

