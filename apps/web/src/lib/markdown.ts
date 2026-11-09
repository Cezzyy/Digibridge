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

/** Lesson Markdown as clean HTML, safe for `v-html`. */
export const renderMarkdown = (source: string) =>
  DOMPurify.sanitize(md.render(source), { USE_PROFILES: { html: true } })
