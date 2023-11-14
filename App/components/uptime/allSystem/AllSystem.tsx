"use client"

import TopSection from "@/components/uptime/topSection/TopSection"
import UptimeStat from "../uptimeStat/UptimeStat"
import ChartSection from "../chartSection/ChartSection"
import { AllSystemContainer } from "./AllSystem.styles"
import { systemData } from "@/data/uptime.data"

const AllSystem = () => {
    return (
      <AllSystemContainer>
        <TopSection system={"All system"} back={false}/>
        <UptimeStat data={systemData}/>
        <ChartSection />
      </AllSystemContainer>
    )
  }

export default AllSystem