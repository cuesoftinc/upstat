import { statusBarProp } from "@/types"
import { ReactNode } from "react"
import {
    StatusHealthContainer,
    StatusBarsContainer,
    StatusBar,
    FinalStat
} from "./StatusHealth.styles"

const StatusBars = ({allStatus} : statusBarProp) => {
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

export default StatusBars