import { ATTEMPT_DURATION_MINUTES, ITEMS_PER_ATTEMPT } from '@digibridge/shared'
import type { StepScreenId } from './StepScreen.vue'

/** The steps from sign-in to lessons, shown on the landing page and the sign-in page. */
export const STEPS: readonly { screen: StepScreenId; title: string; body: string }[] = [
  {
    screen: 'sign-in',
    title: 'Sign in with Google',
    body: 'Your first sign-in makes your DigiBridge account.',
  },
  {
    screen: 'consent',
    title: 'Agree to the privacy notice',
    body: 'It explains what we collect and why, under the Data Privacy Act of 2012.',
  },
  {
    screen: 'profile',
    title: 'Fill in your profile',
    body: 'Your date of birth and sex, and the devices and internet you use.',
  },
  {
    screen: 'questions',
    title: `Answer ${ITEMS_PER_ATTEMPT} questions`,
    body: `You have ${ATTEMPT_DURATION_MINUTES} minutes. Go back and change answers anytime before you submit.`,
  },
  {
    screen: 'results',
    title: 'See your level and lessons',
    body: 'Your results show up as soon as you submit.',
  },
]
