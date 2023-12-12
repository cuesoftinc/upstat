"use client";

import TopSection from "@/components/uptime/topSection/TopSection";
import UptimeStat from "../uptimeStat/UptimeStat";
import ChartSection from "../chartSection/ChartSection";
import { UptimePagesContainer } from "./AllPages.styles";
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
