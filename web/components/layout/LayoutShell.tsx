"use client";
import { useState } from "react";
import MenuBar from "./menuBar/MenuBar";
import { usePathname } from "next/navigation";

const noMenuRoutes = ["/", "/login", "/signup", "/not-found"];

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showMenu = !noMenuRoutes.includes(pathname);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const closeMobileMenu = () => setIsMobileOpen(false);

  return (
    <main>
      {showMenu && (
        <MenuBar isMobileOpen={isMobileOpen} closeMobileMenu={closeMobileMenu} />
      )}
      <div className="content">{children}</div>
    </main>
  );
}