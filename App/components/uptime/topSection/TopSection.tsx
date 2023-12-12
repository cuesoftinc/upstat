"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { topsectionProp } from "@/types/uptime.types";
import {
  OperationStatContainer,
  TopsectionContainer,
  OperationStat,
  UpDownTime,
  StatusBar,
  DownTime,
  Uptime,
} from "./TopSection.styles";

const Topsection = ({ system, back, dot, status }: topsectionProp) => {
  const arr: number[] = new Array(10).fill(0);
  const router = useRouter();

  const goBack = () => {
    router.back();
  };

  const statusTsx = (color: string) => {
    return arr.map((el, i) => (
      <StatusBar key={i} style={{ background: color }} />
    ));
  };

  console.log(status)

  return (
    <TopsectionContainer>
      <OperationStatContainer>
        <OperationStat>
          {dot && 
            <div style={{background: status ? "rgba(0, 224, 158, 0.62)" : "#E63751"}}></div>
          }
          <h2>{system}</h2>
        </OperationStat>
        {back && (
          <div className="goBack" onClick={goBack}>
            <Icon icon="teenyicons:arrow-left-solid" />
            Back
          </div>
        )}
      </OperationStatContainer>
      <UpDownTime>
        <Uptime>
          <p>Uptime</p>
          <div>{statusTsx("rgba(0, 224, 158, 0.62)")}</div>
        </Uptime>
        <DownTime>
          <p>Downtime</p>
          <div>{statusTsx("#E63751")}</div>
        </DownTime>
      </UpDownTime>
    </TopsectionContainer>
  );
};

export default Topsection;
