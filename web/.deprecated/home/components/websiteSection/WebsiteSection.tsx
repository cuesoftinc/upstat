import React from "react";
import {
  BtnGroup,
  WebImage,
  WebsiteCard,
  WebsiteContainer,
  WebsiteWrapper,
} from "./WebsiteSection.styles";
import web from "../../assets/websiteSectionup.png";

const WebsiteSection = () => {
  return (
    <WebsiteWrapper>
      <WebsiteContainer>
        <WebsiteCard>
          <h1>Give your teams the tools they need to track faster</h1>
          <p>
            Upstat simplifies internal tool development for businesses. it
            provides real time monitoring and analysis of website, serve and API
            performance to ensure optimal uptime and user experience for
            businesses
          </p>
          <BtnGroup>
            <button className="web-cloud">Try Cloud</button>
            <button className="web-host">Self-Host</button>
          </BtnGroup>
        </WebsiteCard>
        <WebImage src={web} alt="web" />
      </WebsiteContainer>
    </WebsiteWrapper>
  );
};

export default WebsiteSection;
