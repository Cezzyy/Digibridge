import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { columnName, toXlsx } from './xlsx'

const parts = (file: Uint8Array) =>
  Object.fromEntries(
    Object.entries(unzipSync(file)).map(([path, bytes]) => [path, strFromU8(bytes)]),
  )

describe('columnName', () => {
  it.each([
    [0, 'A'],
    [25, 'Z'],
    [26, 'AA'],
    [701, 'ZZ'],
    [702, 'AAA'],
  ])('names column %i %s', (index, name) => {
    expect(columnName(index)).toBe(name)
  })
})

describe('toXlsx', () => {
  const file = parts(
    toXlsx([
      {
        name: 'People',
        columns: [{ header: 'Name' }, { header: 'Score' }, { header: 'When' }],
        rows: [
          ['Ana & <Ben>', 12.5, new Date('1999-12-31T16:00:00Z')],
          [null, null, null],
        ],
      },
      { name: 'Notes', columns: [{ header: 'Text', wrap: true }], rows: [['=1+1']] },
    ]),
  )

  it('has the workbook, its styles and one part per sheet', () => {
    expect(Object.keys(file).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
      'xl/worksheets/sheet2.xml',
    ])
    expect(file['xl/workbook.xml']).toContain('<sheet name="People" sheetId="1" r:id="rId1"/>')
    expect(file['xl/workbook.xml']).toContain('<sheet name="Notes" sheetId="2" r:id="rId2"/>')
    expect(file['[Content_Types].xml']).toContain('/xl/worksheets/sheet2.xml')
  })

  it('writes a bold, frozen header row with filter buttons over the data', () => {
    const sheet = file['xl/worksheets/sheet1.xml']!
    expect(sheet).toContain('state="frozen"')
    expect(sheet).toContain('<c r="A1" t="inlineStr" s="1">')
    expect(sheet).toContain('<autoFilter ref="A1:C3"/>')
    expect(file['xl/workbook.xml']).toContain("'People'!$A$1:$C$3")
  })

  it('escapes text, keeps numbers as numbers, dates as dates, and skips empty cells', () => {
    const sheet = file['xl/worksheets/sheet1.xml']!
    expect(sheet).toContain('<t xml:space="preserve">Ana &amp; &lt;Ben&gt;</t>')
    expect(sheet).toContain('<c r="B2"><v>12.5</v></c>')
    // Midnight on 2000-01-01 in the Philippines is serial 36526.
    expect(sheet).toContain('<c r="C2" s="2"><v>36526</v></c>')
    expect(sheet).toContain('<row r="3"></row>')
  })

  it('keeps formula-like text as text, wrapped when the column wraps', () => {
    const sheet = file['xl/worksheets/sheet2.xml']!
    expect(sheet).toContain('<c r="A2" t="inlineStr" s="3"><is><t xml:space="preserve">=1+1</t>')
    expect(sheet).not.toContain('<f>')
  })
  it('drops characters XML can’t hold, keeping whole emoji', () => {
    const [sheet] = Object.values(
      parts(
        toXlsx([
          {
            name: 'Odd',
            columns: [{ header: 'Text' }],
            rows: [['a\u0007b￾c\uD83Dd\uDE00e 😀']],
          },
        ]),
      ),
    ).filter((part) => part.includes('<sheetData>'))
    expect(sheet).toContain('<t xml:space="preserve">abcde 😀</t>')
  })
})
