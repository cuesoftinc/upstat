"use client"

import { Icon } from "@iconify/react"
import pulse from "@/assets/images/pulse.png"
import DonoughtChart from "../charts/DonoughtChart"
import { chartSectionProp } from "@/types/uptime.types"
import {
    ChartSectionContainer,
    ResponseTime,
    ResponseHeading,
    PulseContainer,
    PulseDetails,
    PulseTime,
    Pulse,
    OverallUptime,
    OverallHeading,
    OverallBody,
    OverallDonought,
    OverallDetail,
    LeftOverallDetail,
    RightOverallDetail,
} from "./ChartSection.styles"


const ChartSection = ({response, overall}: chartSectionProp ) => {
    const [a, b, c, d] = overall

    const responseTsx = response.map((el, i) => {
        return (
            <PulseTime>
                <h2>{el.figure}ms</h2>
                <span>{el.type}. response time</span>
            </PulseTime>
        )
    })

    const leftOverallTsx = overall.map(el => {
        if(el.id === 2 || el.id === 3) {
            return(
                <div>
                    <h2>{el.percent}%</h2>
                    <p>Last {el.type}</p>
                </div>
            )
        }
    })

    const rightOverallTsx = overall.map(el => {
        if(el.id === 0 || el.id === 1) {
            return(
                <div>
                    <h2>{el.percent}%</h2>
                    <p>Last {el.type}</p>
                </div>
            )
        }
    })


    return (
        <ChartSectionContainer>
            <ResponseTime>
                <ResponseHeading>
                    <div className="left-heading">
                        <span>Response Time</span>
                        <span style={{color: "rgba(255, 255, 255, 0.70)"}}>Last 120days</span>
                    </div>
                    <div className="right-heading">
                        <Icon icon="bi:three-dots-vertical" />
                    </div>
                </ResponseHeading>
                <PulseContainer>
                    <Pulse src={pulse} alt="pulse" />
                </PulseContainer>
                <PulseDetails>
                    {responseTsx}
                </PulseDetails>
            </ResponseTime>
            <OverallUptime>
                <OverallHeading>
                    <span>Overall Uptime</span>
                    <Icon icon="bi:three-dots-vertical" />
                </OverallHeading>
                <OverallBody>
                    <LeftOverallDetail>
                        {leftOverallTsx}
                    </LeftOverallDetail>
                    <OverallDonought>
                        <DonoughtChart />
                    </OverallDonought>
                    <RightOverallDetail>
                        {rightOverallTsx}
                    </RightOverallDetail>
                </OverallBody>
            </OverallUptime>
        </ChartSectionContainer>
    )
}

export default ChartSection