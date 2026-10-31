import { base, vue } from '@digibridge/config/eslint'
import { defineConfig } from 'eslint/config'

// One config for the whole repo. Shared rules live in packages/config/eslint.
export default defineConfig(base, {
  files: ['apps/web/**/*.{ts,vue}'],
  extends: [vue],
})
