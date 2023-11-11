"use client"

import { styled } from "styled-components"

const TopsectionContainer = styled.section`
    background: #16151C;
    display: flex;
    gap: 21px;
    color: #fff;
`

const OperationStat = styled.div`
    display: flex;
    width: 80%;
    background: #3C3C3C;
    gap: 10px;
    align-items: center;
    padding: 42px 17px;
    border-radius: 10px;
    max-width: 881px;
    

    div {
        width: 18px;
        height: 18px;
        background: rgba(0, 224, 158, 0.62);
        border-radius: 50%;
    }
`

const UpDownTime = styled.div`
    display: flex;
    gap: 19px;
    flex-direction: column;
    width: 20%;
    padding: 24px 40px 29px 10px;
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
    TopsectionContainer,
    OperationStat,
    UpDownTime,
    StatusBar,
    DownTime,
    Uptime,
}