import "server-only";

import { DuckDBInstance, type DuckDBValue } from "@duckdb/node-api";
import path from "path";

const dbPath = path.resolve(process.cwd(), "../data/malecns/malecns.duckdb");

const globalForDb = globalThis as unknown as {
  instance: DuckDBInstance | undefined;
};

async function getDbInstance(): Promise<DuckDBInstance> {
  if (!globalForDb.instance) {
    globalForDb.instance = await DuckDBInstance.create(dbPath, {
      access_mode: "READ_ONLY",
    });
  }
  return globalForDb.instance;
}

export async function queryDb<T>(
  query: string,
  params: Record<string, DuckDBValue> = {},
): Promise<T[]> {
  const instance = await getDbInstance();
  const connection = await instance.connect();

  try {
    const result = await connection.run(query, params);
    const rows = await result.getRowObjects();

    return rows as unknown as T[];
  } finally {
    connection.disconnectSync();
  }
}
