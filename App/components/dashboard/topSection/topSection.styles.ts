
import { styled } from "styled-components"

const TopSectionContainer = styled.section`
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 14px 47px 0 25px;
    color: #fff;
    background: #16151c;
`

const HeadSection = styled.div`
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px;
`

const AllStatsContainer = styled.div`
    display: flex;
    gap: 26px;
`

const StatsContainer = styled.div`
    display: flex;
    flex-direction: column;
    border-radius: 10px;
    padding: 22px 15px;
    color: #fff;
    background: #3c3c3c;
    gap: 12px;
`

const MetricsContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 5px;

    h3 {
        margin-right: 34px;
    }
`

export {
    TopSectionContainer,
    AllStatsContainer,
    MetricsContainer,
    StatsContainer,
    HeadSection,
}