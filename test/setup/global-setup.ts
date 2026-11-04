import { execSync } from 'node:child_process';
import { config } from 'dotenv';
import pg from 'pg';

/**
 * Prepara la base de pruebas una sola vez: la crea si no existe y aplica las
 * migraciones. Nunca toca la base de desarrollo: usa DATABASE_URL de .env.test.
 */
export default async function globalSetup(): Promise<void> {
  config({ path: '.env.test', quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL en .env.test (copiá .env.test.example).');

  const dbName = new URL(url).pathname.slice(1);
  // Barrera de seguridad: el setup hace TRUNCATE en cada test.
  if (!dbName.endsWith('_test')) {
    throw new Error(`La base "${dbName}" no termina en _test; se aborta para no borrar datos reales.`);
  }

  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
