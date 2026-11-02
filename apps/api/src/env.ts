import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "../.env.local") });

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseSecretKey: requireEnv("SUPABASE_SECRET_KEY"),
  corsOrigins: (
    process.env.CORS_ORIGINS ?? "https://wiki.matchur.lol,http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
  apiPort: Number(process.env.API_PORT ?? "8001"),
};
