import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // Keep migration debt visible without treating intentional effect-based
  // synchronization of external browser storage as a correctness failure.
  { rules: { '@typescript-eslint/no-explicit-any': 'warn', 'react-hooks/set-state-in-effect': 'warn' } },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
