import js from '@eslint/js'
import prettier from 'eslint-config-prettier/flat'
import pluginVue from 'eslint-plugin-vue'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** Lint rules for every TypeScript file in the repo. */
export const base = defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/coverage/**',
    '**/.turbo/**',
    '**/.wrangler/**',
    '**/migrations/**',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.es2023 },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
    },
  },
  prettier,
)

/** Extra rules for the Vue app, applied on top of `base`. */
export const vue = defineConfig(
  pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  prettier,
)
