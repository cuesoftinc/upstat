"use client";
import CodingView from "@/components/codingView/CodingView";
import styled from "styled-components";
import Workflow from "../components/workflow/Workflow";
import BusinessNeed from "@/components/businessNeed/BusinessNeed";
import OpenSource from "@/components/openSource/openSource/OpenSource";

export default function Home() {
  return (
    <main>
      <CodingView />
      <Workflow />
      <BusinessNeed />
      <OpenSource />
    </main>
  );
}

const Header = styled.div`
  color: red;
  font-size: 23px;
`;
