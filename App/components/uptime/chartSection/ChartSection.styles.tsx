import { keyframes, styled } from "styled-components"
import Image from "next/image"

const pulsing = keyframes`
    0% {
        width: 0%
    }

    100% {
        width: 100%
    }
`

const OverallBody = styled.div`
    display: flex;
    padding: 13px 23px 0 13px;
    justify-content: center;
`

const OverallDetail = styled.div`
    display: flex;
    gap: 52px;
    height: inherit;
    flex-direction: column;
    justify-content: space-between;

    div {
        h2 {
            font-size: 20px;
            font-weight: 500;
            margin-bottom: 2px;
        }

        p {
            color: rgba(255, 255, 255, 0.70);
        }
    }

`

const RightOverallDetail = styled(OverallDetail)`
    div {
        text-align: left;
        margin-left: -8px;
    }
`

const LeftOverallDetail = styled(OverallDetail)`
    div {
        text-align: right;
        margin-right: -8px;
    }
`

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
    padding: 15px 22px 25px 14px;
`

const OverallHeading = styled.div`
    display: flex;
    padding-bottom: 17px;
    font-size: 20px;
    justify-content: space-between;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.50);
`

const PulseContainer = styled.div`
    width: 100%;
    height: fit-content;
    padding: 64px 12.5px 0 0;
    overflow: hidden;
    animation: ${pulsing} 10s linear infinite;
`

const Pulse = styled(Image)`
    height: auto;
`

const PulseDetails = styled.div`
    display: flex;
    gap: 70px;
    margin-top: 10px;
    width: 100%;
`

const PulseTime = styled.div`
    padding-right: 70px;

    &:nth-of-type(1), &:nth-of-type(2) {
        border-right: 1px solid #fff
    }

    h2 {
        font-weight: 500;
        font-size: 20px;
        margin-bottom: 5px;
    }


    p {
        font-weight: 500;
        font-size: 12px;
        white-space: nowrap;
    }
`

const OverallDonought = styled.div`
    min-width: 161px;
    min-height: 161px;
`

export {
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
}