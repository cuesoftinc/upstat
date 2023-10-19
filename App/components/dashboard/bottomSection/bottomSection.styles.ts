import { styled } from "styled-components"

const BottomContainer = styled.section`
    display: flex;
    gap: 29px;
    width: 100%;
    background: #16151C;
    padding: 21px 40px 43px 25px;
    color: #fff
`

const DonoughtSectionContainer = styled.div`
    width: 50%;
    display: flex;
    align-items: center;
    background: #3c3c3c;
    border-radius: 10px;
    padding: 26px 41px 27px 29px;
    gap: 40px;
    height: 100%;
`

const DonoughtDetailsContainer = styled.div`
    width: 50%;
    display: flex; 
    flex-direction: column;
    gap: 19px;
`

const DetailItems = styled.div`
    display: flex;
    gap: 20px;

    div {
        width: 15px;
        height: 15px;
        border-radius: 50%;
    }
    
`

const BarChartContainer = styled.div`
    width: 50%;
    padding: 25px 36px 22px 21px;
    min-height: 266px;
    background: #3c3c3c;
    border-radius: 10px;
`

const DonoughtChartContainer = styled.div`
    width: 50%;
    min-height: 266px;
`

export {
    DonoughtSectionContainer,
    DonoughtDetailsContainer,
    DonoughtChartContainer,
    BarChartContainer,
    BottomContainer,
    DetailItems,
}