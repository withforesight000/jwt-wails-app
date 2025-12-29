// eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from 'typescript-eslint';

export default defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "wailsjs/**"]),
  reactHooks.configs.flat.recommended,
  react.configs.flat.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
]);
