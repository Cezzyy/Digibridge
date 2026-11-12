// A school-link student has no Google account. Saving the profile through a link gives their
// browser a respondent token instead, which it sends in this header on the attempt routes
// (LNK-04). The API keeps only its SHA-256 hash.

export const RESPONDENT_TOKEN_HEADER = 'X-Respondent-Token'

/** 32 random bytes, base64url without padding: 43 characters. */
export const RESPONDENT_TOKEN_BYTES = 32
export const RESPONDENT_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/
