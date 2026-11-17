import type { InferResponseType } from 'hono/client'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { api } from '../lib/api'
import { ApiRequestError, call, messageOf } from '../lib/api'
import { useRespondentFlow, type HeldFlow } from '../composables/useRespondentFlow'

export type Attempt = InferResponseType<(typeof api.attempts)[':id']['$get'], 200>
export type AttemptItem = Attempt['items'][number]
export type SubmittedAttempt = InferResponseType<
  (typeof api.attempts)[':id']['submit']['$post'],
  200
>
/** Where one answer's save is: on its way, saved, or failed after every retry. */
export type SaveState = 'saving' | 'saved' | 'failed'

/**
 * Waits before each retry of a failed save: 3 retries after the first try (TRD). A save refused as
 * `rate_limited` waits for its Retry-After instead, since a try sooner would only be counted again.
 */
const RETRY_DELAYS_MS = [1000, 2000, 4000]
/**
 * When time is up, how long submit waits for saves still on their way before sending anyway.
 * Waiting through every retry could take the submit past the grace period (it would close as
 * expired), so the saves get a few seconds and the server scores what it has.
 */
const TIME_UP_SAVE_WAIT_MS = 5000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// A save worth trying again: no connection, or a hiccup on our side.
const canRetry = (err: unknown) =>
  !(err instanceof ApiRequestError) ||
  err.code === 'network' ||
  err.code === 'rate_limited' ||
  err.status >= 500

/**
 * The attempt on the assessment page: its items in their shuffled order, the answers, where each
 * save is, and the gap between this device's clock and the server's (TRD "Stores").
 * Memory only: a reload fetches it again from GET /attempts/:id (ASM-07).
 *
 * Picking a choice shows it at once and saves it in the background (ASM-04). Saves for one
 * question go one at a time, newest choice last, so a slow older save can't overwrite a newer one.
 * The student's sign-in is taken when the attempt loads, so a save still retrying after they
 * leave the page goes out as them.
 */
export const useAttemptStore = defineStore('attempt', () => {
  const flow = useRespondentFlow()
  /** Whose attempt this is: the calls and state it was loaded with. */
  let owner: HeldFlow | null = null

  const attempt = shallowRef<Attempt | null>(null)
  const answers = ref<Record<string, string>>({})
  const saveStates = ref<Record<string, SaveState>>({})
  /** Server time minus this device's time, in ms. */
  const clockOffset = ref(0)
  /** Index of the item on screen. */
  const current = ref(0)
  /** The server refused a save because the attempt is closed or its time is up. */
  const closed = ref(false)
  const submitting = ref(false)
  const submitError = ref<string | null>(null)
  /**
   * The attempt isn't theirs to submit anymore: the team voided it (409), or it's gone to them
   * (404: a void through a school link also ends the student's token, and a delete removes them).
   */
  const gone = ref(false)

  // The newest choice per question that the server hasn't confirmed, and the save loop running
  // for it. Kept outside Vue's reactivity: only the page's view of them (saveStates) is shown.
  const wanted = new Map<string, string>()
  const running = new Map<string, Promise<void>>()

  const items = computed(() => attempt.value?.items ?? [])
  const answeredCount = computed(() => items.value.filter((i) => answers.value[i.id]).length)
  const unsavedCount = computed(
    () => Object.values(saveStates.value).filter((state) => state !== 'saved').length,
  )
  /** When time runs out, on this device's clock (ms), or null before the attempt loads. */
  const deadline = computed(() =>
    attempt.value ? Date.parse(attempt.value.expiresAt) - clockOffset.value : null,
  )

  function syncClock(serverTime: string) {
    clockOffset.value = Date.parse(serverTime) - Date.now()
  }

  function reset() {
    attempt.value = null
    answers.value = {}
    saveStates.value = {}
    current.value = 0
    closed.value = false
    submitError.value = null
    gone.value = false
    wanted.clear()
    owner = null
  }

  /**
   * Fetches the attempt and its saved answers. Choices still saving, or that failed to save, stay
   * on screen over the server's. Throws ApiRequestError.
   */
  async function load(id: string) {
    const held = flow.hold()
    const data = await call(held.client.attempts[':id'].$get({ param: { id } }))
    const sameAttempt = attempt.value?.id === id
    if (!sameAttempt) reset()
    owner = held

    const nextAnswers: Record<string, string> = {}
    const nextStates: Record<string, SaveState> = {}
    for (const saved of data.answers) {
      nextAnswers[saved.questionId] = saved.choiceId
      nextStates[saved.questionId] = 'saved'
    }
    if (sameAttempt) {
      for (const [questionId, state] of Object.entries(saveStates.value)) {
        const local = answers.value[questionId]
        if (state !== 'saved' && local) {
          nextAnswers[questionId] = local
          nextStates[questionId] = state
        }
      }
    }

    attempt.value = data
    answers.value = nextAnswers
    saveStates.value = nextStates
    syncClock(data.serverTime)
    // A fresh load starts at the first question without an answer.
    if (!sameAttempt) {
      const first = data.items.findIndex((item) => !nextAnswers[item.id])
      current.value = first === -1 ? 0 : first
    }
    return data
  }

  /** Sends one choice, retrying when that might help. True once the server has it. */
  async function send(questionId: string, choiceId: string) {
    const id = attempt.value?.id
    const calls = owner?.client
    if (!id || !calls) return false
    for (let tries = 0; ; tries++) {
      try {
        const saved = await call(
          calls.attempts[':id'].answers[':questionId'].$put({
            param: { id, questionId },
            json: { choiceId },
          }),
        )
        syncClock(saved.serverTime)
        return true
      } catch (err) {
        if (err instanceof ApiRequestError && err.code === 'conflict') {
          closed.value = true
          return false
        }
        const backoff = RETRY_DELAYS_MS[tries]
        if (!canRetry(err) || backoff === undefined) return false
        const retryAfter = err instanceof ApiRequestError ? err.retryAfterSeconds : undefined
        const delay = retryAfter === undefined ? backoff : retryAfter * 1000
        await sleep(delay)
        // A newer choice came in while waiting: the loop sends that one instead.
        if (wanted.get(questionId) !== choiceId) return false
      }
    }
  }

  async function saveLoop(questionId: string) {
    for (;;) {
      const choiceId = wanted.get(questionId)
      if (choiceId === undefined) return
      const ok = await send(questionId, choiceId)
      if (wanted.get(questionId) === choiceId) {
        wanted.delete(questionId)
        saveStates.value = { ...saveStates.value, [questionId]: ok ? 'saved' : 'failed' }
        return
      }
    }
  }

  function queue(questionId: string, choiceId: string) {
    answers.value = { ...answers.value, [questionId]: choiceId }
    saveStates.value = { ...saveStates.value, [questionId]: 'saving' }
    wanted.set(questionId, choiceId)
    if (running.has(questionId)) return
    running.set(
      questionId,
      saveLoop(questionId).finally(() => running.delete(questionId)),
    )
  }

  /** Shows the choice and saves it (ASM-04). Ignored once the attempt is closing. */
  function pick(questionId: string, choiceId: string) {
    if (closed.value || submitting.value) return
    queue(questionId, choiceId)
  }

  /** Tries a failed save again. */
  function retry(questionId: string) {
    const choiceId = answers.value[questionId]
    if (choiceId && saveStates.value[questionId] === 'failed') pick(questionId, choiceId)
  }

  /** Waits for every save on its way, retries included. */
  async function flush() {
    while (running.size > 0) await Promise.all(running.values())
  }

  const failedCount = () =>
    Object.values(saveStates.value).filter((state) => state === 'failed').length

  /**
   * Sends the saves still on their way and tries failed ones again, then submits (ASM-08).
   * If an answer still won't save, it stops with `submitError` set, so no answer on screen is
   * lost, unless `evenIfUnsaved` (time is up: wait a few seconds at most, then send what the
   * server has). Resolves to the closed attempt, or null with `submitError` set. A call made
   * while one is running gets the same result; if it says `evenIfUnsaved`, the running one
   * switches to the time-up rules (time ran out while a manual submit waited on a save).
   */
  function submit({ evenIfUnsaved = false } = {}): Promise<SubmittedAttempt | null> {
    if (!inFlight) {
      let resolveTimeUp = () => {}
      const run: SubmitRun = {
        timeUp: false,
        timeIsUp: new Promise<void>((resolve) => (resolveTimeUp = resolve)),
        markTimeUp: () => {
          run.timeUp = true
          resolveTimeUp()
        },
        result: Promise.resolve(null),
      }
      run.result = sendSubmit(run).finally(() => (inFlight = null))
      inFlight = run
    }
    if (evenIfUnsaved) inFlight.markTimeUp()
    return inFlight.result
  }

  /** The submit on its way: a second call joins it instead of sending again. */
  type SubmitRun = {
    timeUp: boolean
    timeIsUp: Promise<void>
    markTimeUp: () => void
    result: Promise<SubmittedAttempt | null>
  }
  let inFlight: SubmitRun | null = null

  async function sendSubmit(run: SubmitRun): Promise<SubmittedAttempt | null> {
    const id = attempt.value?.id
    const held = owner
    if (!id || !held) return null
    submitting.value = true
    submitError.value = null
    try {
      if (!closed.value) {
        for (const [questionId, state] of Object.entries(saveStates.value)) {
          const choiceId = answers.value[questionId]
          if (state === 'failed' && choiceId) queue(questionId, choiceId)
        }
      }
      // Once time is up, wait a few seconds at most for the saves.
      await Promise.race([flush(), run.timeIsUp.then(() => sleep(TIME_UP_SAVE_WAIT_MS))])
      const failed = failedCount()
      if (failed > 0 && !closed.value && !run.timeUp) {
        submitError.value = `${failed === 1 ? '1 answer' : `${failed} answers`} didn’t save. Check your connection, then try again.`
        return null
      }
      const result = await call(held.client.attempts[':id'].submit.$post({ param: { id } }))
      held.setAttempt({ id: result.id, status: result.status })
      return result
    } catch (err) {
      // A 409 on submit means the team voided it; a 404, that it's gone to them (see `gone`).
      if (err instanceof ApiRequestError && (err.code === 'conflict' || err.code === 'not_found')) {
        gone.value = true
      }
      submitError.value = messageOf(err)
      return null
    } finally {
      submitting.value = false
    }
  }

  return {
    attempt,
    items,
    answers,
    saveStates,
    clockOffset,
    current,
    closed,
    submitting,
    submitError,
    gone,
    answeredCount,
    unsavedCount,
    deadline,
    load,
    pick,
    retry,
    submit,
    reset,
  }
})
