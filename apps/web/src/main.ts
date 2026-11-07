// The opsz cut lets big headings use Bricolage's display shapes (font-optical-sizing is auto).
import '@fontsource-variable/bricolage-grotesque/opsz.css'
import '@fontsource-variable/source-sans-3'
import './style.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(createPinia()).use(router).mount('#app')
