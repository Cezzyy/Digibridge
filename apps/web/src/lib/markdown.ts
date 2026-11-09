import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'

// Lesson bodies are Markdown written by admins (CMS-04). markdown-it turns them into HTML, with
// raw HTML in the Markdown escaped (`html: false`), and DOMPurify cleans the result before the
// page shows it, so nothing in a lesson can run a script (TRD "Security and privacy").
const md = new MarkdownIt({
  html: false,
  // Bare addresses (https://privacy.gov.ph) become links.
  linkify: true,
  // Straight quotes and dashes become typographic ones.
  typographer: true,
  // A single line break stays a line break, as admins expect from a textarea.
  breaks: true,
})

// Links to other sites open in a new tab, so students keep their place in the lesson.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName !== 'A') return
  if (/^https?:\/\//i.test(node.getAttribute('href') ?? '')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * One part of a lesson, from one `##` heading to the next. The lesson page draws each kind its
 * own way: `goals` ("What you’ll learn") beside the title, `part` as a numbered section,
 * `activity` ("Try it") as a task list and `summary` ("Key points") as a closing panel. `intro`
 * is anything before the first heading. `items` holds the first list's items for the goals,
 * activity and summary, and `html` the rest of the part.
 */
export type LessonSectionKind = 'intro' | 'goals' | 'part' | 'activity' | 'summary'

export interface LessonSection {
  id: string
  kind: LessonSectionKind
  title: string
  /** The number in a heading like "2. Read the results page", else null. */
  number: number | null
  html: string
  items: string[]
}

export interface RenderedLesson {
  sections: LessonSection[]
  /** About how long the lesson takes to read, at 200 words a minute. */
  minutes: number
}

const KIND_BY_TITLE: [RegExp, LessonSectionKind][] = [
  [/^what you.?ll learn$/i, 'goals'],
  [/^try it\b/i, 'activity'],
  [/^key points$/i, 'summary'],
]

// `> **Tip:** …` and the like become callouts. A quote with no such label (an example email, a
// sample post) is shown as an example.
const CALLOUT_KINDS = ['tip', 'remember', 'important', 'note', 'example'] as const
type CalloutKind = (typeof CALLOUT_KINDS)[number]

function toCallout(quote: Element) {
  const first = quote.firstElementChild
  const strong = first?.tagName === 'P' ? first.firstChild : null
  const label =
    strong instanceof HTMLElement && strong.tagName === 'STRONG'
      ? strong.textContent.trim().replace(/:$/, '')
      : ''
  const kind = CALLOUT_KINDS.find((k) => k === label.toLowerCase()) as CalloutKind | undefined

  const callout = document.createElement('div')
  callout.className = 'callout'
  callout.setAttribute('role', 'note')
  callout.dataset.kind = kind ?? 'example'

  const title = document.createElement('p')
  title.className = 'callout-label'
  if (kind && strong) {
    title.textContent = label
    strong.remove()
    if (first?.firstChild?.nodeType === Node.TEXT_NODE) {
      first.firstChild.textContent = first.firstChild.textContent?.trimStart() ?? ''
    }
  } else {
    title.textContent = 'Example'
  }

  const body = document.createElement('div')
  body.className = 'callout-body'
  body.append(...quote.childNodes)
  callout.append(title, body)
  quote.replaceWith(callout)
}

/** Tables scroll sideways inside a framed box on small screens. */
function wrapTable(table: Element) {
  const wrap = document.createElement('div')
  wrap.className = 'table-wrap'
  table.replaceWith(wrap)
  wrap.append(table)
}

const slugOf = (title: string) =>
  title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * A lesson's Markdown as clean HTML, split into its parts for the lesson page. Every string in
 * `sections` is safe for `v-html`: it comes from DOMPurify's output, and the changes made here
 * only move its nodes and add fixed class names.
 */
export function renderLesson(source: string): RenderedLesson {
  const fragment = DOMPurify.sanitize(md.render(source), {
    USE_PROFILES: { html: true },
    RETURN_DOM_FRAGMENT: true,
  })
  fragment.querySelectorAll('blockquote').forEach(toCallout)
  fragment.querySelectorAll('table').forEach(wrapTable)

  const words = fragment.textContent.trim().split(/\s+/).filter(Boolean).length
  const sections: LessonSection[] = []
  const used = new Set<string>()
  let body = document.createElement('div')
  let current: Omit<LessonSection, 'html' | 'items'> = {
    id: 'intro',
    kind: 'intro',
    title: '',
    number: null,
  }

  function close() {
    const { kind } = current
    const items: string[] = []
    if (kind === 'goals' || kind === 'activity' || kind === 'summary') {
      const list = body.querySelector(':scope > ul, :scope > ol')
      list?.querySelectorAll(':scope > li').forEach((li) => items.push(li.innerHTML))
      list?.remove()
    }
    const html = body.innerHTML.trim()
    if (html || items.length || kind !== 'intro') sections.push({ ...current, html, items })
    body = document.createElement('div')
  }

  for (const node of [...fragment.childNodes]) {
    if (node instanceof HTMLElement && node.tagName === 'H2') {
      close()
      const text = node.textContent.trim()
      const numbered = text.match(/^(\d+)[.)]\s+(.+)$/)
      const title = numbered?.[2] ?? text
      const kind = KIND_BY_TITLE.find(([pattern]) => pattern.test(text))?.[1] ?? 'part'
      // `part-` keeps the IDs clear of names the page already uses.
      let id = `part-${slugOf(title) || 'section'}`
      for (let n = 2; used.has(id); n++) id = `part-${slugOf(title)}-${n}`
      used.add(id)
      current = { id, kind, title, number: numbered ? Number(numbered[1]) : null }
    } else {
      body.append(node)
    }
  }
  close()

  return { sections, minutes: Math.max(1, Math.round(words / 200)) }
}
