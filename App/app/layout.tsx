import "./globals.css";
import type { Metadata } from "next";
import MenuBar from "@/components/SharedLayouts/MenuBar/MenuBar";
import StyledComponentsRegistry from "@/libs/registry";

export const metadata: Metadata = {
  title: "Upstat",
  description: "The Upstat Project",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>
          <main>
            <MenuBar />
            <div className="content">{children}</div>
          </main>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
