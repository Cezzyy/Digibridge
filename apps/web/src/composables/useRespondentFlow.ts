import { ONLINE_CONSENT_NOTICE, SCHOOL_CONSENT_NOTICE } from '@digibridge/shared'
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { api, type Api } from '../lib/api'
import { previewScope, usePreviewStore } from '../stores/preview'
import { linkConsentKey, useSchoolLinkStore } from '../stores/schoolLink'
import { useSessionStore, type Me } from '../stores/session'

/** A page of the respondent flow. Online at /home, /start/…; through a link at /s/:code/…. */
export type FlowStep = 'consent' | 'profile' | 'home' | 'assessment' | 'results'

export type FlowAttempt = NonNullable<Me['attempt']>

/**
 * A student's calls and attempt updates, fixed when taken (`useRespondentFlow().hold`). For a
 * staff preview, `previewKey` names it, and nothing goes to the attempt routes.
 */
export type HeldFlow = {
  client: Api
  setAttempt: (next: FlowAttempt) => void
  previewKey: string | null
}

const SCHOOL_ROUTE_NAMES = {
  consent: 'school-consent',
  profile: 'school-profile',
  home: 'school-home',
  assessment: 'school-assessment',
  results: 'school-results',
} as const satisfies Record<FlowStep, string>

/**
 * The respondent flow's pages work for both kinds of student: online, signed in with Google (the
 * session store and /me), and through a school link with a respondent token (the schoolLink
 * store and GET /links/:code). This is the one place that tells them apart: which respondent and
 * attempt, which notice, where each step lives, which sign-in its calls send, and how to load
 * them again. School mode is on while a school-link page is on screen (the router's
 * `meta.school`, set once the page has opened).
 */
export function useRespondentFlow() {
  const session = useSessionStore()
  const school = useSchoolLinkStore()
  const previews = usePreviewStore()

  const isSchool = computed(() => school.active)
  const respondent = computed(() =>
    isSchool.value ? school.respondent : (session.me?.respondent ?? null),
  )
  /**
   * Staff trying the student steps, online or through a link: the pages check their answers but
   * save nothing, so their tries stay out of the research data (and off a link's limit). The
   * sample assessment and its result live in the preview store (stores/preview.ts).
   */
  const preview = computed(() => session.isStaff && respondent.value === null)
  /** Which preview this is: the staff account's, online or through this link. */
  const previewKey = computed(() =>
    preview.value && session.me
      ? previewScope(session.me.profile.id, isSchool.value ? school.code : null)
      : null,
  )
  /** The preview got past the profile form, as a student who saved theirs. */
  const previewProfileDone = computed(() =>
    previewKey.value ? previews.profileDone(previewKey.value) : false,
  )
  const attempt = computed<FlowAttempt | null>(() => {
    if (previewKey.value) return previews.attemptFor(previewKey.value)
    return isSchool.value ? school.attempt : (session.me?.attempt ?? null)
  })
  /** Submitted or expired: results is the student's page from now on. */
  const finished = computed(() => {
    const status = attempt.value?.status
    return status === 'submitted' || status === 'expired'
  })
  const notice = computed(() => (isSchool.value ? SCHOOL_CONSENT_NOTICE : ONLINE_CONSENT_NOTICE))
  /** Whose agreement to the notice the consent store holds: the link, or the Google account. */
  const consentKey = computed(() =>
    isSchool.value && school.code ? linkConsentKey(school.code) : (session.me?.profile.id ?? null),
  )
  /** Loading the student's state failed, and App.vue shows the error screen over the page. */
  const failed = computed(() => (isSchool.value ? school.failure : session.failure) !== null)

  /** Where a step of the flow lives for this student. */
  function page(step: FlowStep): RouteLocationRaw {
    return isSchool.value && school.code
      ? { name: SCHOOL_ROUTE_NAMES[step], params: { code: school.code } }
      : { name: step }
  }

  /** After starting or finishing: the attempt the server would now return, without asking. */
  function setAttempt(next: FlowAttempt) {
    // A preview's status lives with its sample assessment, which the preview store updates.
    if (previewKey.value) return
    if (isSchool.value) school.setAttempt(next)
    else session.setAttempt(next)
  }

  /** Asks the server again, when the student's state may have changed (409, 404). */
  function reload() {
    return isSchool.value ? school.reload() : session.loadMe()
  }

  /** The API as this student: the respondent token through a link, else the Google sign-in. */
  function client(): Api {
    return isSchool.value ? school.client() : api
  }

  /**
   * This student's calls and attempt updates as they are now, kept for work that can outlive the
   * page, like an answer's save that retries after the student has moved on: it still goes out
   * as them, and its result lands in their state.
   */
  function hold(): HeldFlow {
    const calls = client()
    const toSchool = isSchool.value
    const key = previewKey.value
    return {
      client: calls,
      setAttempt: (next) => {
        if (key) return
        if (toSchool) school.setAttempt(next)
        else session.setAttempt(next)
      },
      previewKey: key,
    }
  }

  return {
    isSchool,
    respondent,
    attempt,
    finished,
    preview,
    previewKey,
    previewProfileDone,
    notice,
    consentKey,
    failed,
    page,
    setAttempt,
    reload,
    client,
    hold,
  }
}
