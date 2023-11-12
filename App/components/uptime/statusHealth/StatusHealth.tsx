import { statusBarProp } from "@/types"
import { Icon } from "@iconify/react"
import { ReactNode } from "react"
import { styled } from "styled-components"

const StatusBars = ({allStatus} : statusBarProp) => {
    const data: (0 | 1)[] = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1]
    let up: number = 0
    let down: number = 0
    
    for(let i = 0; i < allStatus.length; i++) {
        if( allStatus[i] === 1) {
            up++
        } else if (allStatus[i] === 0) {
            down++
        }
    }

    const statusBarTsx: ReactNode = allStatus.map((el, i) => {
        return <StatusBar key={i} color={el} />
    })

    return (
        <StatusHealthContainer>
            <StatusBarsContainer>
                {statusBarTsx}
            </StatusBarsContainer>
            <FinalStat>
                { up > down ?
                (
                    <>
                        <div style={{background: "rgba(0, 224, 158, 0.62)"}}></div>
                        <p>Up</p>
                    </>
                ) :
                (
                    <>
                        <div style={{background: "#E63751"}}></div>
                        <p>Dn</p>
                    </> 
                )
                }
            </FinalStat>
        </StatusHealthContainer>
    )
}

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

export default StatusBars