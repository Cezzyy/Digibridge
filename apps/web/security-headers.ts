import type { Plugin } from 'vite'

// The web app's security headers (the API's are in apps/api/src/middleware/security-headers.ts).
// Cloudflare Pages sends them from `_headers`, which this plugin writes into the build, because the
// policy names the API and Supabase, whose addresses come from the build's env. `vite preview`
// sends the same headers, so a production build can be checked locally. Not used by `vite dev`,
// whose hot reload needs a looser policy.

/** Lesson videos (components/lessons/LessonVideo.vue). */
const YOUTUBE = 'https://www.youtube-nocookie.com'
/** Cloudflare Web Analytics, which Pages adds to the page once it's turned on: script and beacon. */
const WEB_ANALYTICS = ['https://static.cloudflareinsights.com', 'https://cloudflareinsights.com']

type Env = Record<string, string | undefined>

const originOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : undefined
  } catch {
    return undefined
  }
}

/**
 * Scripts only from this site, so injected markup can't run. Styles allow inline ones: Vue's static
 * markup, table alignment in lessons and index.html's first paint use them, and they can't run
 * code. Pictures may come from any https site, since admins link lesson and question pictures.
 */
export function contentSecurityPolicy(env: Env) {
  const api = originOf(env.VITE_API_URL)
  const supabase = originOf(env.VITE_SUPABASE_URL)
  const directives: Record<string, (string | undefined)[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", WEB_ANALYTICS[0]],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'https:', 'data:'],
    'font-src': ["'self'", 'data:'],
    // The API for everything, Supabase for the sign-in's code exchange.
    'connect-src': ["'self'", api, supabase, WEB_ANALYTICS[1]],
    'frame-src': [YOUTUBE],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }
  return Object.entries(directives)
    .map(([name, sources]) => [name, ...sources.filter(Boolean)].join(' '))
    .join('; ')
}

export function securityHeaders(env: Env): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(env),
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    // Not no-referrer: YouTube refuses embeds that don't say which site they're on.
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Features the app never uses. The video's own (fullscreen and the rest) are left to its iframe.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
  }
}

/** Pages' `_headers` format: a path pattern, then its headers indented under it. */
const headersFile = (headers: Record<string, string>) =>
  ['/*', ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`), ''].join('\n')

export function securityHeadersPlugin(): Plugin {
  let env: Env = {}
  return {
    name: 'digibridge-security-headers',
    configResolved(config) {
      env = config.env
    },
    generateBundle() {
      for (const name of ['VITE_API_URL', 'VITE_SUPABASE_URL']) {
        if (!originOf(env[name])) this.warn(`${name} is missing, so connect-src leaves it out`)
      }
      this.emitFile({
        type: 'asset',
        fileName: '_headers',
        source: headersFile(securityHeaders(env)),
      })
    },
    configurePreviewServer(server) {
      const headers = securityHeaders(env)
      server.middlewares.use((_req, res, next) => {
        for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
        next()
      })
    },
  }
}
