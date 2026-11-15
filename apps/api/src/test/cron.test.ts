// The Worker's scheduled handler, which closes attempts left past their time.
import { areaResults, questions } from '@digibridge/db'
import { ANSWER_GRACE_SECONDS } from '@digibridge/shared'
import { eq, inArray } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import type { ExecutionContext, ScheduledController } from '@cloudflare/workers-types'
import worker from '../index'
import { env, testDb } from './helpers'
import {
  get,
  useQuestionBank,
  attemptsOf,
  save,
  submit,
  started,
  rightChoice,
  setExpiresAt,
} from './fixtures'

useQuestionBank()

describe('cron (scheduled handler)', () => {
  /** Runs the Worker's scheduled handler as the cron trigger would, and waits for it. */
  const runCron = async () => {
    const pending: Promise<unknown>[] = []
    const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p) }
    worker.scheduled({} as ScheduledController, env, ctx as unknown as ExecutionContext)
    await Promise.all(pending)
  }
  const secondsAgo = (s: number) => new Date(Date.now() - s * 1000)

  it('closes attempts past expires_at plus the grace period as expired, with their scores', async () => {
    const late = await started()
    const basic = await testDb
      .select({ id: questions.id })
      .from(questions)
      .where(inArray(questions.id, late.attempt.questionOrder))
      .then((rows) => rows[0]!)
    await save(late.attempt.id, basic.id, await rightChoice(basic.id), late.user.headers)
    const expiresAt = secondsAgo(ANSWER_GRACE_SECONDS + 60)
    await setExpiresAt(late.attempt.id, expiresAt)
    // Still within the grace period, and not due yet.
    const inGrace = await started()
    await setExpiresAt(inGrace.attempt.id, secondsAgo(ANSWER_GRACE_SECONDS - 10))
    const running = await started()

    await runCron()

    const [closed] = await attemptsOf(late.user.respondentId)
    expect(closed).toMatchObject({ status: 'expired', submittedAt: expiresAt })
    expect(closed!.totalPoints).toBeGreaterThan(0)
    expect(
      await testDb.select().from(areaResults).where(eq(areaResults.attemptId, late.attempt.id)),
    ).toHaveLength(3)
    for (const other of [inGrace, running]) {
      expect((await attemptsOf(other.user.respondentId))[0]?.status).toBe('in_progress')
    }
    expect(await (await get('/api/v1/me', late.user.headers)).json()).toMatchObject({
      attempt: { id: late.attempt.id, status: 'expired' },
    })
  })

  it('leaves closed attempts alone, so running it again changes nothing', async () => {
    const { user, attempt } = await started()
    await submit(attempt.id, user.headers)
    await setExpiresAt(attempt.id, secondsAgo(ANSWER_GRACE_SECONDS + 60))
    await runCron()
    await runCron()
    expect((await attemptsOf(user.respondentId))[0]?.status).toBe('submitted')
    expect(
      await testDb.select().from(areaResults).where(eq(areaResults.attemptId, attempt.id)),
    ).toHaveLength(3)
  })
})
