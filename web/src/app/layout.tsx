import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider, themeInitScript } from "@/design/ThemeProvider";
import "./globals.css";

// Design-system fonts (design.md §2): Inter for UI, JetBrains Mono for
// query/data/code text. Exposed as CSS vars consumed by the token layer.
// (Poppins, the styled-components registry and the Google OAuth provider
// left with the W3 legacy tranche — src/legacy, web-implementation.md §8.)
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        {/* pre-paint: applies the persisted `upstat.theme` override before
            first paint (theme-parity canon) — a static literal script */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}