"use client";

import { PrimaryBtn, SecondaryBtn } from "@/components/ui/button/Button";
import {
  HeroContainer,
  HeroContent,
  HeroTitle,
  HeroAccent,
  HeroSubtitle,
  HeroActions,
  ToolsBar,
  ToolsScroll,
  ToolItem,
  ActiveToolItem,
  TextButton
} from "./hero.styles";

const toolList = [
  { name: "Support Tools", active: false },
  { name: "Operational Tools", active: false },
  { name: "Tracking Tools", active: true },
  { name: "Engineering Tools", active: false },
  { name: "Admin Tools", active: false },
];

export default function Hero() {
  return (
    <HeroContainer>
      <HeroContent>
        <HeroTitle>
          <HeroAccent>Speed up</HeroAccent> the development of tracking
          <HeroAccent> application</HeroAccent>
        </HeroTitle>

        <HeroSubtitle>
          The Upstat low-code application platform is employed by numerous teams
          to rapidly Monitor, Track the performance of a system, deploy, and
          oversee robust software, ensuring enterprise-grade security and
          governance.
        </HeroSubtitle>

        <HeroActions>
          <PrimaryBtn label="Try Cloud" />
          <SecondaryBtn label="Self-host" />
        </HeroActions>
      </HeroContent>

      <ToolsBar>
        <ToolsScroll>
          {toolList.map((tool) =>
            tool.active ? (
              <ActiveToolItem key={tool.name}>{tool.name}</ActiveToolItem>
            ) : (
              <ToolItem key={tool.name}>{tool.name}</ToolItem>
            )
          )}
        </ToolsScroll>
        <TextButton label="View More" rightIcon="ph:arrow-right-bold">
        </TextButton>
      </ToolsBar>

    </HeroContainer>
  );
}