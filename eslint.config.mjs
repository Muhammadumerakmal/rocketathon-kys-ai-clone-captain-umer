import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "next-env.d.ts", "src/types/db.ts"],
  },
  {
    // Plan §11.4: prompts must never include demographics.
    files: ["src/lib/ai/prompts/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Identifier[name=/^(age|gender|ethnicity|race|religion|nationality)$/i]",
          message: "Demographics must never reach a prompt (plan §11.4).",
        },
      ],
    },
  },
];

export default config;
