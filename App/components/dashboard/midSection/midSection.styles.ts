import { styled } from "styled-components"

const MidSectionContainer = styled.div`
    display: flex;
    gap: 26px;
    width: 100%;
    padding: 21px 44px 0 25px;
    background: #16151C;
    color: #fff
`

const ChartContainer = styled.div`
    background: #3C3C3C;
    width: 80%;
    height: auto;
    border-radius: 10px;
    padding: 24px 40px;
`

const WebTraffic = styled.div`
    width: 20%;
    background: #3C3C3C;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    padding: 24px;
    font-size: 14px;

    p {
        font-weight: 600;
    }
`


const TrafficItem = styled.div`
    display: flex;
    gap: 10px;
    align-items: center;
`

const TrafficGuage = styled.div`
    width: 100%;
    height: 50%;
    background: rgba(0, 224, 158, 0.62)
`

const Guage = styled.div<{range:number}>`
    width: ${({range}) => range ? `${range}%` : 0};
    height: 100%;
    background: #fff;
`

export {
    MidSectionContainer,
    ChartContainer,
    WebTraffic,
    TrafficGuage,
    TrafficItem,
    Guage
}