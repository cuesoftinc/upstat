"use client";

import BarChart from "../charts/BarChat";
import DonoughtChart from "../charts/DonoughtChart";
import { locationTrafficData } from "@/data/dashboardData";
import {
  DonoughtSectionContainer,
  DonoughtDetailsContainer,
  DonoughtChartContainer,
  BarChartContainer,
  BottomContainer,
  DetailItems,
} from "./BottomSection.styles";

const BottomSection = () => {
  const donoughtDetailTsx = locationTrafficData.map((el) => {
    return (
      <DetailItems key={el.id}>
        <div style={{ background: el.color }}></div>
        <p>{el.name}</p>
        <p>{el.percent}%</p>
      </DetailItems>
    );
  });

  return (
    <BottomContainer>
      <BarChartContainer>
        <BarChart />
      </BarChartContainer>
      <DonoughtSectionContainer>
        <DonoughtChartContainer>
          <DonoughtChart />
        </DonoughtChartContainer>
        <DonoughtDetailsContainer>{donoughtDetailTsx}</DonoughtDetailsContainer>
      </DonoughtSectionContainer>
    </BottomContainer>
  );
};

export default BottomSection;
