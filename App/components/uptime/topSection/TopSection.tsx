"use client"

import { styled } from "styled-components"

type topsectionProp = {
    system : string
}

const Topsection = ({system}: topsectionProp) => {
    const arr: (number | string)[] = new Array(10).fill(0)

    const statusTsx = (color: string) => {
        return arr.map((el, i) => (
            <StatusBar key={i} style={{background: color}} />
        ))
    }

    console.log(statusTsx)

    return (
        <TopsectionContainer>
            <OperationStat>
                <div></div>
                <h2>{system} is operational</h2>
            </OperationStat>
            <UpDownTime>
                <Uptime>
                    <p>Uptime</p>
                    <div>
                        {statusTsx("rgba(0, 224, 158, 0.62)")}
                    </div>
                </Uptime>
                <DownTime>
                    <p>Downtime</p>
                    <div>
                        {statusTsx("#E63751")}
                    </div>
                </DownTime>
            </UpDownTime>
        </TopsectionContainer>
    )

}

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
    min-width: 5.113px;
    min-height: 24.104px;
    border-radius: 3.652px;
`

export default Topsection