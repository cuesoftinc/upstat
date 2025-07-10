"use client";

import React, { useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const router = useRouter();

  const storedValue = localStorage.getItem("token");

  const isUserLoggedIn: any =
    storedValue !== null ? JSON.stringify(storedValue) : null;

  useEffect(() => {
    if (!isUserLoggedIn) {
      router.push("/login");
    }
  }, [router, isUserLoggedIn]);

  return <>{children}</>;
};
