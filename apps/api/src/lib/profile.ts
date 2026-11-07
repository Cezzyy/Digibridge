import { profiles, type Profile } from '@digibridge/db'
import { eq } from 'drizzle-orm'
import type { Db } from '../config/db'

/** The signed-in user, as read from a verified Supabase access token. */
export type TokenUser = {
  id: string
  email: string
  emailVerified: boolean
  fullName: string | null
  avatarUrl: string | null
  /** When the user last signed in with Google (not when the token was refreshed). */
  signedInAt: Date
}

/** ADMIN_EMAILS is a comma-separated list; case and spaces don't matter. */
export function isAdminEmail(email: string, adminEmails: string | undefined) {
  const wanted = email.trim().toLowerCase()
  return (adminEmails ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(wanted)
}

/**
 * Loads the user's profile, creating it on their first API call (AUTH-02).
 * A new account is a respondent, or an admin if its verified email is in ADMIN_EMAILS.
 * The role is only set here; after that only an admin can change it.
 * Name, photo and last sign-in are refreshed once per Google sign-in, not on every request.
 */
export async function loadProfile(db: Db, user: TokenUser, adminEmails: string): Promise<Profile> {
  const [existing] = await db.select().from(profiles).where(eq(profiles.id, user.id))

  if (!existing) {
    const isAdmin = user.emailVerified && isAdminEmail(user.email, adminEmails)
    const [created] = await db
      .insert(profiles)
      .values({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        role: isAdmin ? 'admin' : 'respondent',
        lastSignInAt: user.signedInAt,
      })
      // Two first requests at once: the other one created it, so read theirs.
      .onConflictDoNothing({ target: profiles.id })
      .returning()
    if (created) return created
    const [raced] = await db.select().from(profiles).where(eq(profiles.id, user.id))
    if (!raced) throw new Error(`Profile ${user.id} was neither created nor found`)
    return raced
  }

  if (user.signedInAt > existing.lastSignInAt) {
    const [updated] = await db
      .update(profiles)
      .set({
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        lastSignInAt: user.signedInAt,
      })
      .where(eq(profiles.id, user.id))
      .returning()
    return updated ?? existing
  }

  return existing
}
