import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

/**
 * Flat config for ESLint 9.
 *
 * `npm run lint` has been failing since the ESLint 9 upgrade — the script was
 * left pointing at a config file that never got migrated from .eslintrc, so the
 * whole command errored out before linting anything. Every dependency it needs
 * was already in devDependencies; only the file was missing.
 *
 * Rules are kept to the plugins already installed rather than introducing a new
 * house style: the point is to make the existing script work, not to land a
 * lint sweep across a codebase that has not been linted in a while. Errors are
 * limited to real correctness signals; stylistic opinions stay off.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'gallery/out/**',
      // Playwright specs run under their own tsconfig and target Node globals.
      'e2e/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // The codebase leans on `any` in a number of service/response shapes.
      // Warn so new code gets nudged without turning the existing tree red.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    // Test files add the Vitest globals (configured via `globals: true`).
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    // Node-side tooling: the gallery recorder and its Vite/Tailwind configs.
    files: ['gallery/**/*.{js,mjs,ts,tsx}', '*.config.{js,ts}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
