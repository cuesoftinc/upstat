"use client"

import Header from "@/components/SharedLayouts/Header/Header"
import ChartSection from "@/components/uptime/chartSection/ChartSection"
import TopSection from "@/components/uptime/topSection/TopSection"
import UptimeStat from "@/components/uptime/uptimeStat/UptimeStat"
import { UptimePage } from "./page.styles"


const Uptime = () => {
    return (
      <UptimePage>
        <Header />
        <TopSection system="All system" back={false}/>
        <UptimeStat />
        <ChartSection />
      </UptimePage>
    )
  }

export default Uptime