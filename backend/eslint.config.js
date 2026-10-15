// ESLint 9 flat config — CommonJS (backend has no "type": "module").
// The rule that matters most here is no-undef: it is what would have caught
// the missing `require('crypto')` in auth.controller.js before it shipped.
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      // CLI scripts (db/migrate, create-migration, server boot banner) print
      // to the console on purpose; the app itself logs via utils/logger.
      'no-console': 'off',
      // Best-effort cleanup/parse blocks (`catch {}` after clearCookie,
      // JSON.parse of AI output, dotenv optional load) are intentional.
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];
