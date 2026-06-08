// Derives a dedicated test database URL/name from DATABASE_URL so the test
// suite never touches the development database. Idempotent: if DATABASE_URL
// already points at the `_test` database (e.g. inside a worker), it is returned
// unchanged.

function parse(): { url: URL; name: string } {
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "DATABASE_URL must be set to derive the test database URL",
    );
  }
  const url = new URL(base);
  const name = url.pathname.replace(/^\//, "") || "postgres";
  return { url, name };
}

export function testDatabaseName(): string {
  const { name } = parse();
  return name.endsWith("_test") ? name : `${name}_test`;
}

export function testDatabaseUrl(): string {
  const { url } = parse();
  url.pathname = `/${testDatabaseName()}`;
  return url.toString();
}
