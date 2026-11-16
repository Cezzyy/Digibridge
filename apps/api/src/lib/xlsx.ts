import { strToU8, zipSync } from 'fflate'
import { philippineTime, type Cell, type Sheet } from './sheet'

// Sheets as an Excel workbook (.xlsx, Office Open XML): the few XML parts Excel, LibreOffice and
// Google Sheets need, zipped. Each sheet's header row is bold, frozen and has filter buttons;
// dates are real dates in Philippine time, so they sort and filter as dates.

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

/** Excel caps a cell's text at this many characters. */
const MAX_CELL_TEXT = 32_767
const MAX_WIDTH = 60

// Cell styles, in styles.xml's cellXfs order.
const STYLE = { plain: 0, header: 1, dateTime: 2, wrap: 3 } as const

const STYLES = `${HEAD}<styleSheet xmlns="${MAIN}">\
<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/></numFmts>\
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>\
<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>\
<fills count="2"><fill><patternFill patternType="none"/></fill>\
<fill><patternFill patternType="gray125"/></fill></fills>\
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>\
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>\
<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>\
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>\
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>\
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1">\
<alignment vertical="top" wrapText="1"/></xf></cellXfs>\
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>\
</styleSheet>`

/** Characters XML 1.0 doesn't allow are dropped; the rest are escaped. */
const escape = (text: string) =>
  text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** A, B, ... Z, AA, AB, ... for a column from 0. */
export function columnName(index: number) {
  let name = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  }
  return name
}

/** Days since 1899-12-30, Excel's date serial, for the time on a clock in the Philippines. */
function dateSerial(date: Date) {
  const t = philippineTime(date)
  const ms = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second)
  return ms / 86_400_000 + 25_569
}

const text = (ref: string, value: string, style: number) =>
  `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${escape(
    value.slice(0, MAX_CELL_TEXT),
  )}</t></is></c>`

function cell(ref: string, value: Cell, wrap: boolean): string {
  if (value === null) return ''
  if (value instanceof Date)
    return `<c r="${ref}" s="${STYLE.dateTime}"><v>${dateSerial(value)}</v></c>`
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `<c r="${ref}"><v>${value}</v></c>` : ''
  }
  return text(ref, value, wrap ? STYLE.wrap : STYLE.plain)
}

function worksheet({ columns, rows }: Sheet) {
  const last = columnName(Math.max(columns.length - 1, 0))
  const cols = columns
    .map((column, i) => {
      const width = Math.min(column.width ?? Math.max(column.header.length + 2, 8), MAX_WIDTH)
      return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`
    })
    .join('')
  const header = columns.map((column, i) => text(`${columnName(i)}1`, column.header, STYLE.header))
  const body = rows.map(
    (row, r) =>
      `<row r="${r + 2}">${row
        .map((value, i) => cell(`${columnName(i)}${r + 2}`, value, !!columns[i]?.wrap))
        .join('')}</row>`,
  )
  return `${HEAD}<worksheet xmlns="${MAIN}" xmlns:r="${REL}">\
<sheetViews><sheetView workbookViewId="0">\
<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>\
<sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ''}\
<sheetData><row r="1">${header.join('')}</row>${body.join('')}</sheetData>\
${columns.length ? `<autoFilter ref="A1:${last}${rows.length + 1}"/>` : ''}</worksheet>`
}

/** The sheets, in order, as an .xlsx file. Names must be unique, up to 31 characters. */
export function toXlsx(sheets: Sheet[]): Uint8Array<ArrayBuffer> {
  const sheetList = sheets
    .map(
      (sheet, i) => `<sheet name="${escape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join('')
  // The filter range of each sheet, which LibreOffice reads to show the filter buttons.
  const filters = sheets
    .map((sheet, i) =>
      sheet.columns.length
        ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${escape(
            sheet.name,
          )}'!$A$1:$${columnName(sheet.columns.length - 1)}$${sheet.rows.length + 1}</definedName>`
        : '',
    )
    .join('')

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\
<Default Extension="xml" ContentType="application/xml"/>\
<Override PartName="/xl/workbook.xml" \
ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>\
<Override PartName="/xl/styles.xml" \
ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>\
${sheets
  .map(
    (_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" \
ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  )
  .join('')}</Types>`,
    ),
    '_rels/.rels': strToU8(
      `${HEAD}<Relationships xmlns="${PACKAGE_REL}">\
<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `${HEAD}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>${sheetList}</sheets>\
${filters ? `<definedNames>${filters}</definedNames>` : ''}</workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${HEAD}<Relationships xmlns="${PACKAGE_REL}">${sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join('')}\
<Relationship Id="rId${sheets.length + 1}" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(STYLES),
  }
  sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(worksheet(sheet))
  })
  // fflate always allocates a plain ArrayBuffer, never a shared one.
  return zipSync(files, { level: 6 }) as Uint8Array<ArrayBuffer>
}
