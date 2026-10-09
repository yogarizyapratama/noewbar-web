import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://secoadmin:secopostgres123@localhost:5432/noewbar_db',
  max: 10,
  idleTimeoutMillis: 30000,
});

export default pool;
