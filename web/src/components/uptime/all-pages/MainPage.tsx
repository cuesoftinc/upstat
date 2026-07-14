"use client";

import TopSection from "@/components/uptime/top-section/TopSection";
import UptimeStat from "../uptime-stat/UptimeStat";
import ChartSection from "../chart-section/ChartSection";
import { UptimePagesContainer } from "./all-pages.styles";
import {
  overallUptimeData,
  responseTimeData,
  systemData,
} from "@/data/uptime.data";

const MainPage = () => {
  return (
    <UptimePagesContainer>
      <TopSection
        system={"All system is operational"}
        back={false}
        dot={true}
        status={true}
      />
      <UptimeStat data={systemData} />
      <ChartSection response={responseTimeData} overall={overallUptimeData} />
    </UptimePagesContainer>
  );
};

export default MainPage;
