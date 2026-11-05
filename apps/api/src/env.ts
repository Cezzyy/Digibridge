// Worker environment: [vars], bindings and secrets from wrangler.toml; .dev.vars overrides locally.
export type Bindings = {
  SUPABASE_URL: string
  ADMIN_EMAILS: string
  WEB_ORIGIN: string
  HYPERDRIVE: Hyperdrive
  MEDIA: R2Bucket
}

export type AppEnv = { Bindings: Bindings }
