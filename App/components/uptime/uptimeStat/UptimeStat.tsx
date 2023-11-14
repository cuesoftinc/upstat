"use client"

import { Icon } from "@iconify/react"
import System from "../system/System"
import { systemData } from "@/data/uptime.data"
import {
    UptimeStatContainer,
    UptimeStatHeading,
    StatusHeading
} from "./UptimeStat.styles"
import { uptimeStatProp } from "@/types/uptime.types"

const UptimeStat = ({data}: uptimeStatProp) => {

    const allSystemtsx = data.map((el,i) => {
        return <System 
            key={i} 
            name={el.name} 
            percent={el.percent} 
            allStatus={el.status}
        />
    })
    
    return (
        <UptimeStatContainer>
            <UptimeStatHeading>
                <div className="left-heading">
                    <span>Upstime Stat</span>
                    <span style={{color: "rgba(255, 255, 255, 0.70)"}}>Last 120days</span>
                </div>
                <div className="right-heading">
                    <p>Calendar view</p>
                    <Icon icon="bi:three-dots-vertical" />
                </div>
            </UptimeStatHeading>
            <StatusHeading>
                <p>Name</p>
                <p>Percentage</p>
                <p>Status Health</p>
            </StatusHeading>
            {allSystemtsx}
        </UptimeStatContainer>
    )

}

export default UptimeStat