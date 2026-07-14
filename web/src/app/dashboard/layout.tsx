import "./dashboard.css";
import type { Metadata } from "next";
import MenuBar from "@/components/shared-layouts/menu-bar/MenuBar";

export const metadata: Metadata = {
  title: "Upstat Dashboard",
  description: "The Upstat Project",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main>
      <MenuBar />
      <div className="content">{children}</div>
    </main>
  );
}
