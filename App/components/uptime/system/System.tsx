import { Icon } from "@iconify/react"
import { defaultOverrides } from "next/dist/server/require-hook"
import { StatusBar } from "../topSection/TopSection.styles"
import { styled } from "styled-components"
import StatusHealth from "../statusHealth/StatusHealth"
import { systemProps } from "@/types"


const System = ({name, percent, allStatus}: systemProps) => {
    
    // const

    return (
        <SystemContainer>
            <NameAndPercent>
                <Name>
                    <p>{name}</p>
                    <Icon icon="cil:arrow-right" />
                </Name>
                <p>{percent}%</p>
            </NameAndPercent>
            <StatusHealth allStatus={allStatus} />
        </SystemContainer>
    )
}

const SystemContainer = styled.div`
    display: flex;
    gap: 70px;
    padding: 17px 0 11px;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.50);
    font-size: 20px;
`

const NameAndPercent = styled.div`
    min-width: 380px;
    display: flex;
    justify-content: space-between;
`

const Name = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: 200px;
`

export default System