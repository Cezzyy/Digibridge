import type { InferResponseType } from 'hono/client'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, ApiRequestError, call, messageOf, setRespondentToken } from '../lib/api'

export type OpenLink = InferResponseType<(typeof api.links)[':code']['$get'], 200>
export type LinkRespondent = NonNullable<OpenLink['respondent']>
export type LinkAttempt = NonNullable<OpenLink['attempt']>

/**
 * Why a school link can't be shown, as App.vue's error screen. `not-found`: no link has the code.
 * `gone`: it closed, expired or filled up before this student joined. `unavailable`: the API
 * couldn't be reached.
 */
export type SchoolLinkFailure = { kind: 'not-found' | 'gone' | 'unavailable'; message: string }

/** The student's place in a link: kept in this browser so a refresh or a later visit carries on. */
type Place = { code: string; token: string }

const STORAGE_KEY = 'digibridge:school-link'

/** Who agrees to the notice through a link, for the consent store (no Google account here). */
export const linkConsentKey = (code: string) => `link:${code}`

// Storage can be blocked (private mode, strict settings). The student can still take the
// assessment then, as long as the tab stays open.
function readPlace(): Place | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const place = JSON.parse(raw) as Partial<Place>
    return typeof place.code === 'string' && typeof place.token === 'string'
      ? { code: place.code, token: place.token }
      : null
  } catch {
    return null
  }
}

function writePlace(place: Place | null) {
  try {
    if (place) localStorage.setItem(STORAGE_KEY, JSON.stringify(place))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Kept in memory only.
  }
}

/**
 * The school link a student opened at /s/:code (LNK-02), and their place in it once they joined:
 * the respondent token in `localStorage` (LNK-04), their respondent and their attempt, as
 * GET /links/:code gives them. The router calls `enter` on every school-link page and `leave`
 * on any other, so the API client sends the token on those pages only. `forget` clears the
 * student from this browser (Done, LNK-06; or "Not you?").
 */
export const useSchoolLinkStore = defineStore('schoolLink', () => {
  const place = ref<Place | null>(readPlace())
  /** The code of the school-link page open now, or null on any other page. */
  const code = ref<string | null>(null)
  const link = ref<OpenLink | null>(null)
  const failure = ref<SchoolLinkFailure | null>(null)

  const active = computed(() => code.value !== null)
  /** The link this browser already joined, which comes before any other one opened. */
  const joinedCode = computed(() => place.value?.code ?? null)
  const respondent = computed(() => link.value?.respondent ?? null)
  const attempt = computed(() => link.value?.attempt ?? null)

  const tokenFor = (linkCode: string) => (place.value?.code === linkCode ? place.value.token : null)

  /** A school-link page opens: send this link's token, if the student joined it. */
  function enter(linkCode: string) {
    code.value = linkCode
    setRespondentToken(tokenFor(linkCode))
  }

  /** Any other page opens: back to the Google sign-in, if there is one. */
  function leave() {
    code.value = null
    setRespondentToken(null)
  }

  let loaded: { code: string; done: Promise<void> } | null = null

  async function fetchLink(linkCode: string): Promise<void> {
    failure.value = null
    try {
      link.value = await call(api.links[':code'].$get({ param: { code: linkCode } }))
    } catch (err) {
      link.value = null
      if (err instanceof ApiRequestError && err.code === 'unauthorized' && tokenFor(linkCode)) {
        // The token no longer matches anyone (the team removed the student): start over here.
        forget()
        return fetchLink(linkCode)
      }
      if (err instanceof ApiRequestError && err.code === 'not_found') {
        failure.value = { kind: 'not-found', message: err.message }
      } else if (err instanceof ApiRequestError && err.code === 'gone') {
        failure.value = { kind: 'gone', message: err.message }
      } else {
        failure.value = { kind: 'unavailable', message: messageOf(err) }
      }
    }
  }

  /** Loads the link once per code; later calls wait for the same load. Route guards await it. */
  function open(linkCode: string) {
    if (loaded?.code !== linkCode) loaded = { code: linkCode, done: fetchLink(linkCode) }
    return loaded.done
  }

  /** Loads the link again, for when the student's attempt may have changed on the server. */
  function reload() {
    const linkCode = code.value ?? loaded?.code
    if (!linkCode) return Promise.resolve()
    loaded = { code: linkCode, done: fetchLink(linkCode) }
    return loaded.done
  }

  /** After the profile is saved: keep the token, and the student is in. */
  function join(linkCode: string, token: string, joined: LinkRespondent) {
    place.value = { code: linkCode, token }
    writePlace(place.value)
    if (code.value === linkCode) setRespondentToken(token)
    if (link.value) link.value = { ...link.value, respondent: joined, attempt: null }
  }

  /** After starting or finishing the assessment: what GET /links/:code would now return. */
  function setAttempt(next: LinkAttempt) {
    if (link.value) link.value = { ...link.value, attempt: next }
  }

  /** Clears the student from this browser; the link opens as for a new student. */
  function forget() {
    place.value = null
    writePlace(null)
    setRespondentToken(null)
    loaded = null
    if (link.value) link.value = { ...link.value, respondent: null, attempt: null }
  }

  return {
    code,
    link,
    failure,
    active,
    joinedCode,
    respondent,
    attempt,
    enter,
    leave,
    open,
    reload,
    join,
    setAttempt,
    forget,
  }
})
