import { Icon } from "@iconify/react"
import StatusHealth from "../statusHealth/StatusHealth"
import { systemProps } from "@/types/uptime.types"
import {
    SystemContainer,
    NameAndPercent,
    Name
} from "./System.styles"
import Link from "next/link"

const System = ({name, percent, allStatus}: systemProps) => (
    <SystemContainer>
        <NameAndPercent>
            <Name>
                <Link 
                href={`/uptime/${name.toLocaleLowerCase()}`}
                >
                    {name}
                </Link>
                <Icon icon="cil:arrow-right" />
            </Name>
            <p>{percent}%</p>
        </NameAndPercent>
        <StatusHealth allStatus={allStatus} />
    </SystemContainer>
)

export default System