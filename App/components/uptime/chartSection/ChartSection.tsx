"use client"

import { Icon } from "@iconify/react"
import { styled } from "styled-components"


const ChartSection = () => {
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
            </ResponseTime>
            <OverallUptime>
                <OverallHeading>
                    <span>Overall Uptime</span>
                    <Icon icon="bi:three-dots-vertical" />
                </OverallHeading>
            </OverallUptime>
        </ChartSectionContainer>
    )
}

const ChartSectionContainer = styled.section`
    width: 100%;
    color: white;
    display: flex;
    gap: 28px;
`

const ResponseTime = styled.div`
    width: 60%;
    background: #3C3C3C;
    border-radius: 10px;
    padding: 1px 28px 14px 15px;

`

const ResponseHeading = styled.div`
    display: flex;
    padding: 17px 0;
    justify-content: space-between;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.50);

    div {
        display: flex;
    }

    .left-heading {
        gap: 21px;
        font-size: 20px;
    }

    .right-heading {
        align-items: end;
        gap: 48px;
        
        p {
            font-weight: 600;
            cursor: pointer;
            &:hover {
                text-decoration: underline;
            }
        }
    }
`

const OverallUptime = styled.div`
    width: 40%;
    background: #3C3C3C;
    border-radius: 10px;
    padding: 3px 18px 17px 17px;
`

const OverallHeading = styled.div`
    display: flex;
    padding: 17px 0;
    justify-content: space-between;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.50);
`

export default ChartSection