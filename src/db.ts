import sql from 'mssql';

let pool: sql.ConnectionPool | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool) {
    return pool;
  }

  const config: sql.config = {
    server: requireEnv('ODCANIT_DB_HOST'),
    database: requireEnv('ODCANIT_DB_NAME'),
    user: requireEnv('ODCANIT_DB_USER'),
    password: requireEnv('ODCANIT_DB_PASSWORD'),
    port: process.env.ODCANIT_DB_PORT ? Number(process.env.ODCANIT_DB_PORT) : 1433,
    options: {
      encrypt: process.env.ODCANIT_DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.ODCANIT_DB_TRUST_CERT === 'true',
    },
  };

  pool = await new sql.ConnectionPool(config).connect();
  return pool;
}

export async function queryOdcanit<T>(query: string, params: Record<string, unknown>): Promise<T[]> {
  const connection = await getPool();
  const request = connection.request();

  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }

  const result = await request.query<T>(query);
  return result.recordset;
}
