"use client"

import TopSection from "@/components/uptime/top-section/TopSection"
import UptimeStat from "../uptime-stat/UptimeStat"
import ChartSection from "../chart-section/ChartSection"
import { overallUptimeData, responseTimeData, systemData } from "@/data/uptime.data"
import { UptimePagesContainer } from "./all-pages.styles"
import Events from "../events/Events"

const BlogPage = () => {
  const blogData = [systemData[3]]
  const status = blogData[0].status
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
          system={`Blog is ${up > down ? "Operational" : "down"}`} 
          back={true} 
          dot={true}
          status={(up > down ? true : false)}
        />
        <UptimeStat data={blogData}/>
        <ChartSection response={responseTimeData} overall={overallUptimeData}/>
        <Events/>
      </UptimePagesContainer>
    )
  }

export default BlogPage