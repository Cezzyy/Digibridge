import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/source-sans-3'
import './style.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(createPinia()).use(router).mount('#app')
