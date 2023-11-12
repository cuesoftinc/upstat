import { styled } from "styled-components"

const StatusHealthContainer = styled.div`
    display: flex;
    gap: 62px;
`

const StatusBarsContainer = styled.div`
    display: flex;
    gap: 5px;
`

const StatusBar = styled.div<{color: number}>`
    background: ${({color}) => color === 1 ? "rgba(0, 224, 158, 0.62)" : "#E63751"};
    width: 7px;
    height: 33px;
    border-radius: 5px;
`

const FinalStat = styled.div`
    display: flex;
    gap: 5px;
    align-items: center;

    div {
        width: 14px;
        height: 14px;
        border-radius: 50%;
    }
`

export {
    StatusHealthContainer,
    StatusBarsContainer,
    StatusBar,
    FinalStat
}