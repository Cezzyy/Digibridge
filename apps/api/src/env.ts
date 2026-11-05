// Worker environment: values from .dev.vars locally, Wrangler secrets in production.
export type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SECRET_KEY: string
  ADMIN_EMAILS: string
  WEB_ORIGIN: string
}

export type AppEnv = { Bindings: Bindings }
