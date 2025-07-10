"use client";

import { webTrafficData } from "../../../data/dashboard.data";
import LineChart from "../charts/LineChart";
import {
  MidSectionContainer,
  ChartContainer,
  WebTraffic,
  TrafficGuage,
  TrafficItem,
  Guage,
} from "./MidSection.styles";

const MidSection = () => {
  const webTrafficTsx = webTrafficData.map((el) => {
    return (
      <TrafficItem key={el.id}>
        <span>{el.name}</span>
        <TrafficGuage>
          <Guage range={el.range} />
        </TrafficGuage>
      </TrafficItem>
    );
  });

  return (
    <MidSectionContainer>
      <ChartContainer>
        <LineChart />
      </ChartContainer>
      <WebTraffic>
        <p>Traffic By Website</p>
        {webTrafficTsx}
      </WebTraffic>
    </MidSectionContainer>
  );
};

export default MidSection;
