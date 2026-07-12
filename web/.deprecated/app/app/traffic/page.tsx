"use client";
import TrafficComponent from "@/components/traffic/trafficSection/TrafficSection";
import { TrafficPage } from "./page.styles";
import Header from "@/components/SharedLayouts/Header/Header";
import { ProtectedRoute } from "@/components/otherComponents/protectRoute/ProtectedRoute";

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
