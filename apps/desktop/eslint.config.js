import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  // Vendored registry code (Bklit charts, React Bits, Magic UI), updated with the shadcn CLI:
  // type-checked with the app, but not held to the app's lint rules.
  globalIgnores([
    "dist",
    "coverage",
    "playwright-report",
    "test-results",
    "src-tauri",
    "src/components/charts",
    "src/components/shimmering-text.tsx",
    "src/astryx-themes.ts",
    "src/themes/*/devatlas.*",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json", "./e2e/tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // shadcn/ui modules export variant helpers next to components by design.
    files: ["src/components/ui/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // Playwright fixtures hand their value to `use()`, which is not React's hook.
    files: ["e2e/**/*.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  // Must stay last: turns off stylistic rules that Prettier owns.
  prettier,
]);
