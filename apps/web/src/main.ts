// The opsz cut lets big headings use Bricolage's display shapes (font-optical-sizing is auto).
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource-variable/source-sans-3'
import './style.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { useSessionStore } from './stores/session'

const app = createApp(App).use(createPinia()).use(router)

// A bug no code caught (in a component or an event handler) would otherwise leave part of the
// page blank with no word why: show the "page" error screen instead, whose Try again reloads.
app.config.errorHandler = (err) => {
  console.error(err)
  useSessionStore().failPage()
}

app.mount('#app')
