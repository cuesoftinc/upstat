"use client"
import { Icon } from "@iconify/react"
import {
    TopSectionContainer,
    AllStatsContainer,
    MetricsContainer,
    StatsContainer,
    HeadSection,
} from "./topSection.styles"


const downChart = "streamline:money-graph-arrow-decrease-down-stats-graph-descend-right-arrow"
const upChart = "streamline:money-graph-arrow-increase-ascend-growth-up-arrow-stats-graph-right-grow"

const statsData: {
    id: number,
    name: string,
    number: string,
    percent: string,
    chart: string,
    color: string,
}[] = [
    {
        id: 0,
        name: "Web Views",
        number: "658k",
        percent: "+3.08",
        chart: upChart,
        color: "#00E09E"
    },
    {
        id: 1,
        name: "Unique Visitors",
        number: "246k",
        percent: "-8.36",
        chart: downChart,
        color: "#FF3D5A"
    },
    {
        id: 2,
        name: "New Users",
        number: "1352",
        percent: "+2.65",
        chart: upChart,
        color: "#00E09E"
    },
    {
        id: 3,
        name: "Page VIew",
        number: "438",
        percent: "-0.37",
        chart: downChart,
        color: "#FF3D5A"
    },
    {
        id: 0,
        name: "Active Users",
        number: "294k",
        percent: "-5.12",
        chart: downChart,
        color: "#FF3D5A"
    },
]

const TopSection = () => {
    const statsTsx = statsData.map(el => {
        return (
            <StatsContainer key={el.id}>
                <p>{el.name}</p>
                <MetricsContainer>
                    <h3>{el.number}</h3>
                    <p>{el.percent}</p>
                    <Icon 
                        icon={el.chart}
                        style={{color: el.color}}
                    />
                </MetricsContainer>
            </StatsContainer>
        )
    })

    return (
        <TopSectionContainer>
            <HeadSection>
                <Icon icon="ph:traffic-sign" />
                <p>Today</p>
            </HeadSection>
            <AllStatsContainer>
                {statsTsx}
            </AllStatsContainer>
        </TopSectionContainer>
    )
}

export default TopSection