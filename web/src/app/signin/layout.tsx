import type { Metadata } from "next";

// Route metadata for the client-composed signin screen (fleet P9 pattern:
// "Sign in — {Product}"; the page itself is a client component).
export const metadata: Metadata = {
  title: "Sign in — Upstat",
  description: "Sign in to Upstat with Google",
};

export default function SignInLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
