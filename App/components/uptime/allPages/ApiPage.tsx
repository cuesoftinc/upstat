"use client"

import TopSection from "@/components/uptime/topSection/TopSection"
import UptimeStat from "../uptimeStat/UptimeStat"
import ChartSection from "../chartSection/ChartSection"
import { overallUptimeData, responseTimeData, systemData } from "@/data/uptime.data"
import { UptimePagesContainer } from "./AllPages.styles"
import Events from "../events/Events"

const ApiPage = () => {
  const apiData = [systemData[0]]
  const status = apiData[0].status
  let up: number = 0;
  let down: number = 0;

  for (let i = 0; i < status.length; i++) {
    if (status[i] === 1) {
      up++;
    } else if (status[i] === 0) {
      down++;
    }
  }

  return (
    <UptimePagesContainer>
      <TopSection 
        system={`Website is ${up > down ? "Operational" : "down"}`} 
        back={true} 
        dot={true}
        status={(up > down)}
      />
      <UptimeStat data={apiData}/>
      <ChartSection response={responseTimeData} overall={overallUptimeData}/>
      <Events/>
    </UptimePagesContainer>
  )
}

export default ApiPage