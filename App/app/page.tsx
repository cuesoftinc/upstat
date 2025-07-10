"use client";
import BottomSection from "@/components/dashboard/bottomSection/BottomSection";
import MidSection from "@/components/dashboard/midSection/MidSection";
import TopSection from "@/components/dashboard/topSection/TopSection";
import { ProtectedRoute } from "@/components/otherComponents/protectRoute/ProtectedRoute";
import Header from "@/components/SharedLayouts/Header/Header";
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
