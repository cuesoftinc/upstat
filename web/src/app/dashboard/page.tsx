"use client";
import BottomSection from "@/components/dashboard/bottom-section/BottomSection";
import MidSection from "@/components/dashboard/mid-section/MidSection";
import TopSection from "@/components/dashboard/top-section/TopSection";
import { ProtectedRoute } from "@/components/other-components/protect-route/ProtectedRoute";
import Header from "@/components/shared-layouts/header/Header";
import { styled } from "styled-components";

export default function Home() {
  return (
    <ProtectedRoute>
      <Header />
      <TopSection />
      <MidSection />
      <BottomSection />
    </ProtectedRoute>
  );
}
