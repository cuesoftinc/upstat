"use client"

import { Icon } from "@iconify/react"
import { styled } from "styled-components"
import pulse from "@/assets/images/pulse.png"
import Image from "next/image"


const ChartSection = () => {
        const responseData:
        {
            type: string,
            figure: number
        }[] = [
            {
                type: "Avg",
                figure: 159.26
            },
            {
                type: "Max",
                figure: 462.63
            },
            {
                type: "Min",
                figure: 125.84
            },
        ]

        const responseTsx = responseData.map((el, i) => {
            return (
                <Figure>
                    <h2>{el.figure}ms</h2>
                    <span>{el.type}. response time</span>
                </Figure>
            )
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
                <ChartContainer>
                    <Pulse src={pulse} alt="pulse" />
                </ChartContainer>
                <FiguresContainer>
                    {responseTsx}
                </FiguresContainer>
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

const ChartContainer = styled.div`
    width: 100%;
    height: fit-content;
    padding: 64px 12.5px 0 0;
`

const Pulse = styled(Image)`
    width: 100%;
    height: auto;
`

const FiguresContainer = styled.div`
    display: flex;
    gap: 70px;
    margin-top: 10px;
    width: 100%;
`

const Figure = styled.div`
    padding-right: 70px;

    &:nth-of-type(1), &:nth-of-type(2) {
        border-right: 1px solid #fff
    }

    h2 {
        font-weight: 500;
        font-size: 20px;
        margin-bottom: 5px;
    }


    span {
        font-weight: 500;
        font-size: 12px
    }

`

export default ChartSection