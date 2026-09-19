import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  {
    ignores: [".next/**", ".next-dev/**", "node_modules/**", "public/**", "supabase/migrations/**", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Viewport prefetching on a fully dynamic site renders a page per visible
      // link and was most of the Vercel CPU bill. Use the intent-prefetching
      // wrapper instead (it is the one file allowed to import next/link).
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "next/link", message: 'Import Link from "@/components/ui/app-link" instead.' }] },
      ],
    },
  },
];

export default eslintConfig;
