require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

client.connect()
  .then(() => client.query(`
    SELECT current_database() AS db,
           (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS tables
  `))
  .then((result) => {
    console.log(JSON.stringify(result.rows[0]));
    return client.end();
  })
  .catch((err) => {
    console.error('FAIL', err.message);
    process.exit(1);
  });
