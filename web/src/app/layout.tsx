import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";
import StyledComponentsRegistry from "@/components/libs/Registry";
import { GoogleOAuthProvider } from "@react-oauth/google";

// Legacy font (pre-W0 routes) — retires with the legacy dashboard (W3).
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Inlined at build time; Google sign-in buttons no-op without it rather
  // than taking the whole site down.
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

  return (
    <html
      lang="en"
      className={`${poppins.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <GoogleOAuthProvider clientId={googleClientId}>
          <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}