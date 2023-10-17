"use client"

import { useState } from "react"
import { totalUserData, webTrafficData } from "../data"
import LineChart from "../charts/LineChart"
import {
    MidSectionContainer,
    ChartContainer,
    WebTraffic,
    TrafficGuage,
    TrafficItem,
    Guage
} from "./MidSection.styles"

const MidSection = () => {
    const [chartData, setChartData] = useState({
        labels: totalUserData.map((data) => data.horizontal),
        datasets: [
            {
            label: "Total Users",
            data: totalUserData.map((data) => data.vertical),
            borderColor: "rgba(0, 224, 158, 0.62)",
            borderWidth: 2,
            },
        ],
    })

    const webTrafficTsx = webTrafficData.map(el => {
        return (
            <TrafficItem key={el.id}>
                <span>{el.name}</span>
                <TrafficGuage>
                    <Guage range={el.range}/>
                </TrafficGuage>
            </TrafficItem>
        )
    })

    return (
        <MidSectionContainer>
            <ChartContainer>
                <LineChart chartData={chartData} />
            </ChartContainer>
            <WebTraffic>
                <p>Traffic By Website</p>
                {webTrafficTsx}
            </WebTraffic>
        </MidSectionContainer>
    )
}

export default MidSection