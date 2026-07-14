"use client";
import TrafficComponent from "@/components/traffic/traffic-section/TrafficSection";
import { TrafficPage } from "./page.styles";
import Header from "@/components/shared-layouts/header/Header";
import { ProtectedRoute } from "@/components/other-components/protect-route/ProtectedRoute";

const Traffic = () => {
  return (
    <ProtectedRoute>
      <Header />
      <TrafficPage>
        <TrafficComponent />
      </TrafficPage>
    </ProtectedRoute>
  );
};

export default Traffic;
