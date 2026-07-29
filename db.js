// PostgreSQL connection + schema setup.
//
// Set DATABASE_URL in your environment (locally in backend/.env, and on
// Render under the service's "Environment" tab) to your Postgres connection
// string, e.g.:
//   DATABASE_URL=postgresql://user:password@host:5432/dbname
//
// Render-hosted Postgres (and most managed providers) require SSL — this is
// handled automatically below.

const { Pool } = require("pg");

const rawConnectionString = process.env.DATABASE_URL;

// pg-connection-string emits a "SECURITY WARNING" when it sees sslmode=require
// (etc.) in the URL, since we already control SSL explicitly via the `ssl`
// option below. Strip those query params so only our explicit config applies
// and the warning is never triggered.
function stripSslModeParams(urlString) {
  try {
    const url = new URL(urlString);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("channel_binding");
    return url.toString();
  } catch {
    return urlString;
  }
}

const connectionString = rawConnectionString
  ? stripSslModeParams(rawConnectionString)
  : rawConnectionString;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: connectionString.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    })
  : null;

if (!pool) {
  console.error(
    "⚠️  DATABASE_URL not set — startup registrations will NOT be saved persistently."
  );
}

// Creates the tables this app needs, if they don't already exist.
// Called once on server startup.
async function initDb() {
  if (!pool) return;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS startup_registrations (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    console.log("🗄️  Postgres: startup_registrations table ready");
  } catch (err) {
    console.error("❌ Postgres init error:", err.message);
  }
}

module.exports = { pool, initDb };
