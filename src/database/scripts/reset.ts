import 'dotenv/config';

import { Pool } from 'pg';

/** Drops every table, type and the migration journal. Development only. */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to reset a production database');
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
    console.log('Database reset');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
