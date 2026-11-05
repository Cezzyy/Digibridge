import { z } from 'zod'

// ACLC student number (PRO-02). Saved in uppercase and unique across online and kiosk.

/** 1 letter and 2 digits, 2 digits, 4 digits, then 3 letters and 3 digits, with dashes. */
export const STUDENT_NUMBER_REGEX = /^[A-Z]\d{2}-\d{2}-\d{4}-[A-Z]{3}\d{3}$/
export const STUDENT_NUMBER_EXAMPLE = 'C23-01-7557-MAN121'

/** Trims and uppercases the input, then checks the ACLC format. */
export const studentNumberSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(STUDENT_NUMBER_REGEX, {
    message: `Enter your student number like this: ${STUDENT_NUMBER_EXAMPLE}`,
  })
