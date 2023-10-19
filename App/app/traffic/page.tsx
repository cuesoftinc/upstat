"use client";
import TrafficComponent from "@/components/traffic/trafficSection/TrafficSection";
import { TrafficPage } from "./page.styles";
import Header from "@/components/SharedLayouts/Header/Header";

const Traffic = () => {
  return (
    <>
      <Header />
      <TrafficPage>
        <TrafficComponent />
      </TrafficPage>
    </>
  );
};

export default Traffic;
