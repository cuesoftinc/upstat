"use client"

import TopSection from "@/components/uptime/topSection/TopSection"
import UptimeStat from "../uptimeStat/UptimeStat"
import ChartSection from "../chartSection/ChartSection"
import { AllSystemContainer } from "./AllSystem.styles"
import { overallUptimeData, responseTimeData, systemData } from "@/data/uptime.data"

const AllSystem = () => {
    return (
      <AllSystemContainer>
        <TopSection system={"All system"} back={false}/>
        <UptimeStat data={systemData}/>
        <ChartSection response={responseTimeData} overall={overallUptimeData}/>
      </AllSystemContainer>
    )
  }

export default AllSystem