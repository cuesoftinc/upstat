"use client";

import React, { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // localStorage is browser-only; access it after mount so SSR/prerender is safe.
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    } else {
      setChecked(true);
    }
  }, [router]);

  if (!checked) return null;

  return <>{children}</>;
};
