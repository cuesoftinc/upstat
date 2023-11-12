import { Icon } from "@iconify/react"
import StatusHealth from "../statusHealth/StatusHealth"
import { systemProps } from "@/types"
import {
    SystemContainer,
    NameAndPercent,
    Name
} from "./System.styles"

const System = ({name, percent, allStatus}: systemProps) => (
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

export default System