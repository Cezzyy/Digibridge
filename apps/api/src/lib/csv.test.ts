import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'

const csv = (rows: (string | number | Date | null)[][], headers = ['A', 'B']) =>
  toCsv({ name: 'Test', columns: headers.map((header) => ({ header })), rows })

describe('toCsv', () => {
  it('starts with a byte order mark and ends each line with CRLF', () => {
    expect(csv([['x', 1]])).toBe('\uFEFFA,B\r\nx,1\r\n')
  })

  it('leaves null empty and numbers as they are, negative ones too', () => {
    expect(csv([[null, -2.5]])).toBe('\uFEFFA,B\r\n,-2.5\r\n')
  })

  it('quotes commas, quotes and line breaks, doubling the quotes', () => {
    expect(csv([['Cruz, Juan', 'say "hi"\nthere']])).toBe(
      '\uFEFFA,B\r\n"Cruz, Juan","say ""hi""\nthere"\r\n',
    )
  })

  it('keeps text that looks like a formula from running', () => {
    expect(
      csv([
        ['=1+1', '@SUM(A1)'],
        ['+63', '-x'],
      ]),
    ).toBe("\uFEFFA,B\r\n'=1+1,'@SUM(A1)\r\n'+63,'-x\r\n")
  })

  it('writes dates and times in Philippine time', () => {
    expect(csv([[new Date('2026-11-16T06:03:05Z'), null]])).toBe(
      '\uFEFFA,B\r\n2026-11-16 14:03:05,\r\n',
    )
  })
})
