import { LINK_CODE_ALPHABET, LINK_CODE_LENGTH } from '@digibridge/shared'
import { randomInt } from './shuffle'

/** A new school link's code for its URL (/s/<code>), from the Web Crypto random source. */
export function newLinkCode(): string {
  let code = ''
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)]
  }
  return code
}
