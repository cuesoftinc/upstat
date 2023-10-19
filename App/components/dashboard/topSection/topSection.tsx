"use client"
import { Icon } from "@iconify/react"
import {
    TopSectionContainer,
    AllStatsContainer,
    MetricsContainer,
    StatsContainer,
    HeadSection,
} from "./TopSection.styles"
import { statsData } from "@/data/dashboardData"


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