import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const sdkModules = [
  'pg',
  'kysely',
  'stripe',
  '@anthropic-ai/sdk',
  'openai',
  'resend',
  'googleapis',
  'google-auth-library',
];

const sdkPatterns = sdkModules.map((name) => ({
  group: [name, `${name}/*`],
  message:
    'SDKs and drivers belong in packages/adapters or an app composition root (src/container.ts).',
}));

const workspace = ['domain', 'ports', 'application', 'agents', 'adapters', 'testing', 'i18n'];

/** Bans every workspace package except `allowed`, plus SDKs, for files in `pkg`. */
function layer(pkg, allowed, { testsMayUseTesting = false } = {}) {
  const banned = (extra) =>
    workspace
      .filter((name) => name !== pkg && !allowed.includes(name) && !extra.includes(name))
      .map((name) => ({
        group: [`@thp/${name}`, `@thp/${name}/*`, `**/${name}/src/*`],
        message: `packages/${pkg} may import only: ${allowed.join(', ') || 'nothing from the workspace'}.`,
      }));
  const rule = (extra) => ['error', { patterns: [...banned(extra), ...sdkPatterns] }];
  const configs = [
    { files: [`packages/${pkg}/**/*.ts`], rules: { 'no-restricted-imports': rule([]) } },
  ];
  if (testsMayUseTesting) {
    configs.push({
      files: [`packages/${pkg}/**/*.test.ts`],
      rules: { 'no-restricted-imports': rule(['testing']) },
    });
  }
  return configs;
}

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': true, 'ts-nocheck': true },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'it', property: 'only', message: 'Do not commit .only.' },
        { object: 'it', property: 'skip', message: 'Do not skip tests.' },
        { object: 'describe', property: 'only', message: 'Do not commit .only.' },
        { object: 'describe', property: 'skip', message: 'Do not skip tests.' },
        { object: 'test', property: 'only', message: 'Do not commit .only.' },
        { object: 'test', property: 'skip', message: 'Do not skip tests.' },
      ],
      'no-restricted-imports': ['error', { patterns: sdkPatterns }],
    },
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  ...layer('domain', []),
  ...layer('ports', ['domain']),
  ...layer('application', ['domain', 'ports'], { testsMayUseTesting: true }),
  ...layer('agents', ['domain', 'ports'], { testsMayUseTesting: true }),
  ...layer('adapters', ['domain', 'ports'], { testsMayUseTesting: true }),
  ...layer('testing', ['domain', 'ports']),
  ...layer('i18n', []),
  {
    files: ['packages/adapters/**/*.ts', 'apps/*/src/container.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
);
