"use client"
import BottomSection from "@/components/dashboard/bottomSection/BottomSection";
import MidSection from "@/components/dashboard/midSection/MidSection";
import TopSection from "@/components/dashboard/topSection/TopSection";
import Header from "@/components/otherComponents/Header/Header";
import { styled } from "styled-components";

export default function Home() {
  return (
    <DashboardPage>
      <Header />
      <TopSection />
      <MidSection />
      <BottomSection />
    </DashboardPage>
  )
}


const DashboardPage = styled.div`
  display: flex;
  height: 100%;
  flex-direction: column;
`