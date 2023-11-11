import {
    TopsectionContainer,
    OperationStat,
    UpDownTime,
    StatusBar,
    DownTime,
    Uptime,
} from "./topSection.styles"

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

export default Topsection