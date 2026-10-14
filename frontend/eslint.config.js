import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    // Build output, deps, and quarantined sync-conflict copies.
    ignores: ['dist/**', 'node_modules/**', '**/*SFConflict*', '**/*.backup'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // Match tsconfig's noUnusedLocals/noUnusedParameters, but allow the
      // conventional leading-underscore escape hatch for deliberate unused args.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // console.warn/error are legitimate for user-facing failures; bare
      // console.log is debug residue and should not reach main.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Node-land config files.
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier
);
