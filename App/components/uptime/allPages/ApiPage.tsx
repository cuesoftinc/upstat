"use client"

import TopSection from "@/components/uptime/topSection/TopSection"
import UptimeStat from "../uptimeStat/UptimeStat"
import ChartSection from "../chartSection/ChartSection"
import { overallUptimeData, responseTimeData, systemData } from "@/data/uptime.data"
import { UptimePagesContainer } from "./AllPages.styles"

const ApiPage = () => {
  const apiData = [systemData[0]]

    return (
      <UptimePagesContainer>
        <TopSection system={"API system"} back={true}/>
        <UptimeStat data={apiData}/>
        <ChartSection response={responseTimeData} overall={overallUptimeData}/>
      </UptimePagesContainer>
    )
  }

export default ApiPage