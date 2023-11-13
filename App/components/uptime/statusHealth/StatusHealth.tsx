import { statusBarProp } from "@/types/uptime.types"
import { ReactNode } from "react"
import {
    StatusHealthContainer,
    StatusBarsContainer,
    StatusBar,
    FinalStat,
    Dot
} from "./StatusHealth.styles"


const rand = (a: number,b: number) => Math.random() < 0.5 ? a : b

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
        return <StatusBar key={i} color={el} sec={rand(0.1, 0)} />
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
                        <Dot color="rgba(0, 224, 158, 0.62)"></Dot>
                        <p>Up</p>
                    </>
                ) :
                (
                    <>
                        <Dot color="#E63751"></Dot>
                        <p>Dn</p>
                    </> 
                )
                }
            </FinalStat>
        </StatusHealthContainer>
    )
}

export default StatusBars