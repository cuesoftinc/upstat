"use client"
import BottomSection from "@/components/dashboard/bottomSection/BottomSection";
import MidSection from "@/components/dashboard/midSection/MidSection";
import TopSection from "@/components/dashboard/topSection/TopSection";
import Header from "@/components/SharedLayouts/Header/Header";
import { styled } from "styled-components";

export default function Home() {
  return (
    <>
      <Header />
      <TopSection />
      <MidSection />
      <BottomSection />
    </>
  )
}