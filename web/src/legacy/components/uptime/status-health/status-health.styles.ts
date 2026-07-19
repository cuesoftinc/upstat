import { keyframes, styled } from "styled-components"

const blink = keyframes<{color: number}>`
    0% {
        background: none;
    }

    100% {
        background: ${({color}) => color === 1 ? "rgba(0, 224, 158, 0.62)" : "#E63751"};
    }
`

const blink2 = keyframes<{color: string}>`
    0% {
        background: none;
    }

    100% {
        background: ${({color}) => color };
    }
`

const StatusHealthContainer = styled.div`
    display: flex;
    gap: 62px;
`

const StatusBarsContainer = styled.div`
    display: flex;
    gap: 5px;
`

const StatusBar = styled.div<{color: number, sec: number}>`
    background: ${({color}) => color === 1 ? "rgba(0, 224, 158, 0.62)" : "#E63751"};
    width: 7px;
    height: 33px;
    border-radius: 5px;
    animation: ${blink} ${({sec}) => sec}s ease infinite alternate;
`

const FinalStat = styled.div`
    display: flex;
    gap: 5px;
    align-items: center;
`

const Dot = styled.div<{color: string}>`
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: ${({color}) => color};
    animation: ${blink2} 1s ease infinite alternate;
`

export {
    StatusHealthContainer,
    StatusBarsContainer,
    StatusBar,
    FinalStat,
    Dot
}