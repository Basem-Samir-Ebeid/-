import { createRequire } from "node:module";
import app from "../artifacts/api-server/dist/index.mjs";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL must be set.");
const pool = new Pool({ connectionString: databaseUrl, ...(databaseUrl.includes(".neon.tech") ? { ssl: { rejectUnauthorized: false } } : {}) });

process.env.DATABASE_URL = databaseUrl;

export default function handler(request, response) {
  const path = request.query?.path;
  if (typeof path === "string" && path.length > 0) {
    request.url = `/api/${path.replace(/^\/+/, "")}`;
  }

  request.db = pool;
  return app(request, response);
}
