import { RESPONDENT_TOKEN_BYTES, RESPONDENT_TOKEN_REGEX } from '@digibridge/shared'

// The token a school-link student's browser keeps in place of a Google sign-in (LNK-04). It is
// sent to the browser once, when the profile is saved; the database keeps only its SHA-256 hash,
// so a leaked database can't be used to take over anyone's attempt.

const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')

/** The hash saved in `respondents.access_token_hash`, as 64 hex characters. */
export async function hashRespondentToken(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))
}

/** True for a string shaped like a token, before it's worth hashing and looking up. */
export const isRespondentToken = (token: string) => RESPONDENT_TOKEN_REGEX.test(token)

/** A new token from the Web Crypto random source, and its hash. */
export async function newRespondentToken() {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(RESPONDENT_TOKEN_BYTES)))
  return { token, hash: await hashRespondentToken(token) }
}
