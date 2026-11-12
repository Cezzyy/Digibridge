import { ONLINE_CONSENT_NOTICE, SCHOOL_CONSENT_NOTICE } from '@digibridge/shared'
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { linkConsentKey, useSchoolLinkStore } from '../stores/schoolLink'
import { useSessionStore, type Me } from '../stores/session'

/** A page of the respondent flow. Online at /home, /start/…; through a link at /s/:code/…. */
export type FlowStep = 'consent' | 'profile' | 'home' | 'assessment' | 'results'

export type FlowAttempt = NonNullable<Me['attempt']>

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
 * attempt, which notice, where each step lives, and how to load them again. School mode is on
 * while a school-link page is open (the router's `meta.school`).
 */
export function useRespondentFlow() {
  const session = useSessionStore()
  const school = useSchoolLinkStore()

  const isSchool = computed(() => school.active)
  const respondent = computed(() =>
    isSchool.value ? school.respondent : (session.me?.respondent ?? null),
  )
  const attempt = computed<FlowAttempt | null>(() =>
    isSchool.value ? school.attempt : (session.me?.attempt ?? null),
  )
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
    if (isSchool.value) school.setAttempt(next)
    else session.setAttempt(next)
  }

  /** Asks the server again, when the student's state may have changed (409, 404). */
  function reload() {
    return isSchool.value ? school.reload() : session.loadMe()
  }

  return {
    isSchool,
    respondent,
    attempt,
    finished,
    notice,
    consentKey,
    failed,
    page,
    setAttempt,
    reload,
  }
}
