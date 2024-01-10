import React, { useState } from "react";
import {
  ToolContainer,
  TabHeader,
  TabButton,
  ComponentSection,
} from "./Tools.styles";
import Image from "next/image";
import upstat from "../../assets/Upstat-desktopup.png";
import { Icon } from "@iconify/react";
import Partner from "../partners/Partner";

const ToolSection = () => {
  const [active, setActive] = useState(3);

  const handleTab = (ev: number) => {
    setActive(ev);
  };
  return (
    <>
      <ToolContainer>
        <TabHeader>
          <TabButton active={active === 1} onClick={() => handleTab(1)}>
            Support Tools
          </TabButton>
          <TabButton active={active === 2} onClick={() => handleTab(2)}>
            Operational Tools
          </TabButton>
          <TabButton active={active === 3} onClick={() => handleTab(3)}>
            Tracking Tools
          </TabButton>
          <TabButton active={active === 4} onClick={() => handleTab(4)}>
            Engineering Tools
          </TabButton>
          <TabButton active={active === 5} onClick={() => handleTab(5)}>
            Admin Tools
          </TabButton>
          <TabButton
            active={active === 8}
            style={{ textDecoration: "underline" }}
          >
            <a href="/">View More</a>{" "}
            <span>
              <Icon icon="material-symbols-light:arrow-right-alt-rounded" />
            </span>
          </TabButton>
        </TabHeader>
        <ComponentSection>
          {active === 1 && <Image src={upstat} alt="upstat" />}
          {active === 2 && <Image src={upstat} alt="upstat" />}
          {active === 3 && <Image src={upstat} alt="upstat" />}
          {active === 4 && <Image src={upstat} alt="upstat" />}
          {active === 5 && <Image src={upstat} alt="upstat" />}
        </ComponentSection>
      </ToolContainer>
      <Partner />
    </>
  );
};

export default ToolSection;
