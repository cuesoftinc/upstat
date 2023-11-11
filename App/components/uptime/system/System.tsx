import { Icon } from "@iconify/react"
import { defaultOverrides } from "next/dist/server/require-hook"
import { StatusBar } from "../topSection/TopSection.styles"

const System = () => {
    
    const 
    return (
        <SystemContainer>
            <Name>
                <p>API</p>
                <Icon icon="cil:arrow-right" />
            </Name>
            <Percentage>98</Percentage>
            <AllStatusBar />
        </SystemContainer>
    )
}

export default System