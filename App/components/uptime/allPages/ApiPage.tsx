"use client"

import TopSection from "@/components/uptime/topSection/TopSection"
import UptimeStat from "../uptimeStat/UptimeStat"
import ChartSection from "../chartSection/ChartSection"
import { overallUptimeData, responseTimeData, systemData } from "@/data/uptime.data"
import { UptimePagesContainer } from "./AllPages.styles"
import Events from "../events/Events"

const ApiPage = () => {
  const apiData = [systemData[0]]

    return (
      <UptimePagesContainer>
        <TopSection system={"API system"} back={true}/>
        <UptimeStat data={apiData}/>
        <ChartSection response={responseTimeData} overall={overallUptimeData}/>
        <Events/>
      </UptimePagesContainer>
    )
  }

export default ApiPage