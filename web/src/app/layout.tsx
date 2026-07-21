import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import {
  ColorVisionProvider,
  colorVisionInitScript,
} from "@/design/ColorVisionProvider";
import { ThemeProvider, themeInitScript } from "@/design/ThemeProvider";
import "./globals.css";

// Design-system fonts (design.md §2): Inter for UI, JetBrains Mono for
// query/data/code text. Exposed as CSS vars consumed by the token layer.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Upstat",
  description: "The Upstat Project",
};

// No maximumScale: pinch-zoom must stay available (2026-07-21 a11y audit
// blocker — axe meta-viewport on every route; siblings' viewport export is
// the fleet pattern).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // suppressHydrationWarning: the pre-paint script may set data-theme
    // before React hydrates the <html> element (apparule ThemeProvider
    // contract — the persisted-light boot flagged a dev hydration warning)
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* pre-paint: applies the persisted `upstat.theme` override and the
            `upstat.colorvision` mode before first paint — static literal
            scripts (theme-parity canon; design.md §5 colorblind mode) */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: colorVisionInitScript }} />
        <ThemeProvider>
          <ColorVisionProvider>{children}</ColorVisionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
