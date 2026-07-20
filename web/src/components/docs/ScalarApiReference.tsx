"use client";

// Scalar API reference embed (X-2) — renders the interactive reference
// from the repo's canonical spec served at /docs/api/openapi.yaml. The
// embed follows the product theme: dark/light comes from ThemeProvider
// (dark-primary, design.md §2), Scalar's own toggle is hidden, and the
// remote default fonts are disabled (self-host ethos: no external
// runtime dependencies) so the reference renders in the app's font
// stack.
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { useTheme } from "@/design/ThemeProvider";

export function ScalarApiReference() {
  const { theme } = useTheme();

  return (
    <ApiReferenceReact
      configuration={{
        url: "/docs/api/openapi.yaml",
        darkMode: theme === "dark",
        hideDarkModeToggle: true,
        withDefaultFonts: false,
      }}
    />
  );
}
