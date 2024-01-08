import React from "react";
import { HeroWrapper } from "./Hero.styles";
import HeaderBar from "../headerBar/HeaderBar";

const HeroSection = () => {
  return (
    <>
      <HeaderBar />
      <HeroWrapper>
        <h1>
          <span>Speed up</span> the development of tracking{" "}
          <span>application</span>
        </h1>

        <p>
          The Upstat low-code application platform is employed by numerous teams
          to rapidly Monitor, Track the performance of a system, deploy, and
          oversee robust software, ensuring enterprise-grade security and
          governance.
        </p>

        <div>
          <button className="cloud">Try Cloud</button>
          <button className="host">Self-host</button>
        </div>
      </HeroWrapper>
    </>
  );
};

export default HeroSection;
