"use client"

import { Icon } from '@iconify/react';
import { styled } from "styled-components"
import {
    OperationStatContainer,
    TopsectionContainer,
    OperationStat,
    UpDownTime,
    StatusBar,
    DownTime,
    Uptime,
} from "./TopSection.styles"
import { useRouter } from 'next/navigation';

interface topsectionProp  {
    system : string,
    back: boolean
}

const Topsection = ({system, back}: topsectionProp) => {
    const arr: (number | string)[] = new Array(10).fill(0)
    const router = useRouter();

    const goBack = () => {
      router.back();
    }

    const statusTsx = (color: string) => {
        return arr.map((el, i) => (
            <StatusBar key={i} style={{background: color}} />
        ))
    }

    console.log(statusTsx)

    return (
        <TopsectionContainer>
            <OperationStatContainer>
                <OperationStat>
                    <div></div>
                    <h2>{system} is operational</h2>
                </OperationStat>
                {back && (
                    <div className='goBack' onClick={goBack}>
                        <Icon icon="teenyicons:arrow-left-solid" />
                        Back
                    </div>
                )}
            </OperationStatContainer>
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