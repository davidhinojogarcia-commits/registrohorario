import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    files: ["components/ui/**/*.{ts,tsx}", "hooks/use-mobile.ts"],
    rules: {
      // These files are vendored verbatim from shadcn@4.17.0. Keep the
      // registry source intact while applying the stricter rules to Site code.
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: [
      "app/admin-adjustments.tsx",
      "app/admin-alerts.tsx",
      "app/admin-reports.tsx",
      "app/admin-trips.tsx",
      "app/trabajador/trip-tracker.tsx",
    ],
    rules: {
      // These client components intentionally hydrate remote API state from effects.
      // Updates occur after asynchronous fetch/geolocation work, not as render-derived state.
      "react-hooks/set-state-in-effect": "off",
      // AdminReports intentionally reuses its async loader after selecting the first worker.
      "react-hooks/immutability": "off",
    },
  },
]);

export default eslintConfig;
