import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "coverage/**",
    ],
  },
  {
    files: ["src/**/*.ts"],
    plugins: {
      "@stylistic": stylistic,
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    extends: [
      js.configs.recommended,
      stylistic.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.strictTypeChecked,
    ],
    rules: {
      "@stylistic/indent": ["error", 2],
      "@stylistic/quotes": ["error", "double"],
      "@stylistic/semi": ["error", "always"],
      "@stylistic/max-len": ["warn", { code: 150 }],
      "@stylistic/comma-dangle": ["error", "always-multiline"],
      "@stylistic/member-delimiter-style": ["error", {
        multiline: { delimiter: "semi", requireLast: true },
        singleline: { delimiter: "semi", requireLast: false },
      }],
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
  },
  {
    files: ["src/type-engine/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
    },
  },
  {
    files: ["src/**/*.test.ts", "src/**/*.test-d.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
