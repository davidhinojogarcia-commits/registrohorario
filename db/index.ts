import { Pool, type PoolClient } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

type BoundValue = string | number | boolean | null;

function databaseUrl() {
  const value = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!value) throw new Error("Falta DATABASE_URL (o POSTGRES_URL) de Neon.");
  return value;
}

let pool: Pool | undefined;

function getPool() {
  pool ??= new Pool({ connectionString: databaseUrl() });
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}

function postgresPlaceholders(query: string) {
  let index = 0;
  return query.replace(/\?/g, () => `$${++index}`);
}

class PreparedQuery {
  private values: BoundValue[] = [];

  constructor(private readonly query: string) {}

  bind(...values: BoundValue[]) {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>() {
    const result = await getPool().query(postgresPlaceholders(this.query), this.values);
    return (result.rows[0] as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>() {
    const result = await getPool().query(postgresPlaceholders(this.query), this.values);
    return { results: result.rows as T[] };
  }

  async run(client?: PoolClient) {
    return (client ?? getPool()).query(postgresPlaceholders(this.query), this.values);
  }
}

export type DatabaseClient = ReturnType<typeof getRawDb>;

export function getRawDb() {
  return {
    prepare(query: string) {
      return new PreparedQuery(query);
    },
    async batch(statements: PreparedQuery[]) {
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        const results = [];
        for (const statement of statements) results.push(await statement.run(client));
        await client.query("COMMIT");
        return results;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
