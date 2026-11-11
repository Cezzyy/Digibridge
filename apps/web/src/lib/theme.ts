// Pages with `meta.followsSystemTheme` (the admin area) switch to dark when the system is dark:
// `data-theme="system"` on <html> turns on the dark tokens in style.css, and a second
// theme-color tag colors the phone's browser bar to match. Other pages stay light.

/** The dark theme's page color (--color-mist in style.css), for the browser bar. */
const DARK_BAR = '#0e1813'

let darkBar: HTMLMetaElement | null = null

export function followSystemTheme(follow: boolean) {
  const root = document.documentElement
  if (follow) root.dataset.theme = 'system'
  else delete root.dataset.theme

  if (follow && !darkBar) {
    darkBar = document.createElement('meta')
    darkBar.name = 'theme-color'
    darkBar.media = '(prefers-color-scheme: dark)'
    darkBar.content = DARK_BAR
    // The first tag whose media matches wins, so it goes before the light one.
    document.head.prepend(darkBar)
  } else if (!follow && darkBar) {
    darkBar.remove()
    darkBar = null
  }
}
