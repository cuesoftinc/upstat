import { keyframes, styled } from "styled-components"

const TopsectionContainer = styled.section`
    display: flex;
    gap: 21px;
    color: #fff;
    font-weight: 600;
`

const OperationStatContainer = styled.div`
    display: flex;
    flex-direction: column;
    width: 80%;
    background: #3C3C3C;
    padding: 24px 17px;
    border-radius: 10px;
    gap: 10px;
    justify-content: center;

    .goBack {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 500;
        cursor: pointer;

        &:hover {
            text-decoration: underline;
        }
    }
`

const OperationStat = styled.div`
    display: flex;
    gap: 10px;
    align-items: center;
    max-width: 881px;
    

    div {
        width: 18px;
        height: 18px;
        border-radius: 50%;
    }
`

const UpDownTime = styled.div`
    display: flex;
    gap: 19px;
    flex-direction: column;
    width: 20%;
    padding: 24px 10px;
    background: #3C3C3C;
    border-radius: 10px;
    max-width: width: 881px;
`

const Uptime = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;

    div {
        display: flex;
        gap: 3.7px;
    }
`

const DownTime = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;

    div {
        display: flex;
        gap: 3.7px;
    }
`

const StatusBar = styled.div`
    width: 5.113px;
    height: 24.104px;
    border-radius: 3.652px;
`

export {
    OperationStatContainer,
    TopsectionContainer,
    OperationStat,
    UpDownTime,
    StatusBar,
    DownTime,
    Uptime,
}