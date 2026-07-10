import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import StyledComponentsRegistry from "@/components/libs/registry";
import { ThemeProvider } from "styled-components";
import { darkTheme } from "@/components/libs/theme2";
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const envoyUrl = process.env.NEXT_PUBLIC_ENVOY_URL;

  if (!googleClientId || !envoyUrl) {
    throw new Error("Missing workspace configuration keys in .env.local");
  }

  return (
    <html lang="en" className={poppins.variable}>
      <body>
        <GoogleOAuthProvider clientId={googleClientId}>
          <StyledComponentsRegistry>
            <ThemeProvider theme={darkTheme}>
              {children}
            </ThemeProvider>
          </StyledComponentsRegistry>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}