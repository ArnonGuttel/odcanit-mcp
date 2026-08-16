import sql from 'mssql';

let pool: sql.ConnectionPool | null = null;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function writesEnabled(): boolean {
  return process.env.ODCANIT_DB_ENABLE_WRITES === 'true';
}

export function assertWritesEnabled(): void {
  if (!writesEnabled()) {
    throw new Error('Writes are disabled. Set ODCANIT_DB_ENABLE_WRITES=true to enable write tools.');
  }
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool) {
    return pool;
  }

  const instanceName = process.env.ODCANIT_DB_INSTANCE;
  if (instanceName && process.env.ODCANIT_DB_PORT) {
    throw new Error(
      'ODCANIT_DB_INSTANCE and ODCANIT_DB_PORT are mutually exclusive: named SQL Server instances ' +
        'resolve their TCP port dynamically via the SQL Server Browser service (UDP 1434). Set one or the other.'
    );
  }

  const config: sql.config = {
    server: requireEnv('ODCANIT_DB_HOST'),
    database: requireEnv('ODCANIT_DB_NAME'),
    user: requireEnv('ODCANIT_DB_USER'),
    password: requireEnv('ODCANIT_DB_PASSWORD'),
    options: {
      encrypt: process.env.ODCANIT_DB_ENCRYPT !== 'false',
      trustServerCertificate: process.env.ODCANIT_DB_TRUST_CERT === 'true',
      ...(instanceName ? { instanceName } : {}),
    },
  };

  if (!instanceName) {
    config.port = process.env.ODCANIT_DB_PORT ? Number(process.env.ODCANIT_DB_PORT) : 1433;
  }

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
