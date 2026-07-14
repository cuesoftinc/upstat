"use client";
import TrafficComponent from "@/components/traffic/traffic-section/TrafficSection";
import { TrafficPage } from "./page.styles";
import Header from "@/components/shared-layouts/header/Header";

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
