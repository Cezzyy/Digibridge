import { exportFileName, todayInPhilippines, type ExportFormat } from '@digibridge/shared'
import { ref } from 'vue'
import { api, callFile, messageOf } from '../lib/api'

/** Saves a file the page already has, as if its link were clicked with `download`. */
function saveFile(file: Blob, name: string) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // Some browsers start the download after the click returns, so the address stays a moment.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Downloads the respondents as CSV or Excel (DSH-06), admin only: the rows the table shows for
 * `query` (its filters, status, search and sort), every page. One download at a time.
 */
export function useExport() {
  const busy = ref<ExportFormat | null>(null)
  const error = ref<string | null>(null)

  async function download(format: ExportFormat, query: Record<string, string>) {
    if (busy.value) return
    busy.value = format
    error.value = null
    try {
      const file = await callFile(
        format === 'csv'
          ? api.admin['export.csv'].$get({ query })
          : api.admin['export.xlsx'].$get({ query }),
      )
      saveFile(file, exportFileName(format, todayInPhilippines()))
    } catch (err) {
      error.value = messageOf(err)
    } finally {
      busy.value = null
    }
  }

  return { busy, error, download }
}
