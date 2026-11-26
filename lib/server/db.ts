import "server-only";
import postgres from "postgres";

export const hasDatabase = Boolean(process.env.DATABASE_URL);
const globalDb = globalThis as typeof globalThis & {
  maquetteDb?: ReturnType<typeof postgres>;
};
export function database() {
  if (!hasDatabase)
    throw new Error(
      "Cloud storage is not configured. Save or share a local snapshot instead.",
    );
  return (globalDb.maquetteDb ??= postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: 3,
    connect_timeout: 8,
    idle_timeout: 20,
  }));
}
