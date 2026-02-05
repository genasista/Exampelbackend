// ESLint v9 flat config, minimal & pragmatic for TS backend (no type-aware slowdowns)

const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");

module.exports = [
  // Ignore generated & build output
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "**/*.d.ts",
      "coverage/**",
      "src/contracts/openapi/types.d.ts",
    ],
  },

  // Lint all .ts files with TS parser
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2024,
        sourceType: "module",
        // Note: We’re not enabling "project" yet, since type-aware linting is slower
        // and unnecessary for most CI checks. If you need rules that require full
        // type information, uncomment these:
        // project: "./tsconfig.json",
        // tsconfigRootDir: __dirname,
      },
      globals: {
        // Node globals (harmless + avoids no-undef noise if used)
        process: "readonly",
        __dirname: "readonly",
        module: "readonly",
        require: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Start with JS recommended base
      ...js.configs.recommended.rules,

      // Prefer TS-aware unused-vars; allow underscore prefix to intentionally ignore
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // TS handles undefined checks
      "no-undef": "off",

      // Reasonable defaults for backend repos
      "no-console": "off",
      "prefer-const": "warn",
      "eqeqeq": ["warn", "smart"],
      "curly": ["warn", "all"],
    },
    linterOptions: {
      // Warn if someone uses // eslint-disable with no effect
      reportUnusedDisableDirectives: true,
    },
  },
];
