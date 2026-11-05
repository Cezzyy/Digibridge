import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

// DATABASE_URL lives in packages/db/.env (see .env.example). `generate` doesn't need it.
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  // Migrations go to the root supabase/ folder, named the way the Supabase CLI expects,
  // so `supabase db push` applies them.
  out: '../../supabase/migrations',
  migrations: { prefix: 'supabase' },
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
  strict: true,
  verbose: true,
})
