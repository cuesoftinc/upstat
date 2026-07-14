import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import StyledComponentsRegistry from "@/components/libs/Registry";
import { GoogleOAuthProvider } from "@react-oauth/google";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={poppins.variable}>
      <body>
        <GoogleOAuthProvider clientId={googleClientId}>
          <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}