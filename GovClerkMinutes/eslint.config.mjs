import preferSpelling from "eslint-plugin-prefer-spelling";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    plugins: {
      // TODO: needs update to support eslint 9
      // "prefer-spelling": preferSpelling,
    },

    rules: {
      "react/jsx-curly-brace-presence": [
        "error",
        {
          props: "never",
          children: "never",
        },
      ],

      "react/jsx-boolean-value": ["error", "never"],

      "no-console": [
        "warn",
        {
          allow: ["warn", "error", "info"],
        },
      ],

      "array-bracket-spacing": ["error", "never"],
      semi: ["error", "always"],
      "object-curly-spacing": ["error", "always"],

      quotes: [
        "error",
        "double",
        {
          avoidEscape: true,
        },
      ],

      "space-infix-ops": "error",
      curly: ["error", "all"],

      // TODO: needs update to support eslint 9
      // "prefer-spelling/prefer-spelling": [
      //   "error",
      //   {
      //     words: {
      //       canceled: "canceled",
      //       canceling: "canceling",
      //     },
      //   },
      // ],
    },
  },
  {
    files: [
      "src/scripts/**/*.js",
      "src/scripts/**/*.ts",
      "src/common/build/**/*.ts",
      "src/common/build/**/*.js",
      "public/**/*.js",
      "build/**/*.js",
      ".next/**/*.js",
    ],

    rules: {
      "@next/next/no-assign-module-variable": "off",
      "no-console": "off",
      semi: "off",
      "object-curly-spacing": "off",
      quotes: "off",
      "space-infix-ops": "off",
      curly: "off",
    },
  },
];

export default config;
