"use client"
import MidSection from "@/components/dashboard/midSection/midSection";
import TopSection from "@/components/dashboard/topSection/topSection";
import Header from "@/components/otherComponents/Header/Header";
import { styled } from "styled-components";

export default function Home() {
  return (
    <DashboardPage>
      <Header />
      <TopSection />
      <MidSection />
    </DashboardPage>
  )
}


const DashboardPage = styled.div`
  width: 100%;
`