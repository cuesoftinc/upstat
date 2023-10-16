"use client";
import React, { useState } from "react";
import AccountInfo from "@/components/otherComponents/setting/accountInfo/AccountInfo";
import {
  ComponentSection,
  SettingContainer,
  TabButton,
  TabHeader,
} from "./page.styles";
import { Icon } from "@iconify/react";
import EmailSetting from "@/components/otherComponents/setting/email/EmailSetting";
import PasswordSetting from "@/components/otherComponents/setting/password/PasswordSetting";
import SecuritySetting from "@/components/otherComponents/setting/security/SecuritySetting";

const Settings = () => {
  const [active, setActive] = useState(1);

  const handleTab = (ev: number) => {
    setActive(ev);
  };
  return (
    <SettingContainer>
      <TabHeader>
        <TabButton active={active === 1} onClick={() => handleTab(1)}>
          <span>
            <Icon icon="simple-line-icons:note" />
          </span>{" "}
          Account Info
        </TabButton>
        <TabButton active={active === 2} onClick={() => handleTab(2)}>
          <span>
            <Icon icon="fontisto:email" />
          </span>{" "}
          Email
        </TabButton>
        <TabButton active={active === 3} onClick={() => handleTab(3)}>
          <span>
            <Icon icon="solar:lock-outline" />
          </span>{" "}
          Password
        </TabButton>
        <TabButton active={active === 4} onClick={() => handleTab(4)}>
          <span>
            <Icon icon="carbon:security" />
          </span>{" "}
          Security
        </TabButton>
      </TabHeader>
      <ComponentSection>
        {active === 1 && <AccountInfo />}
        {active === 2 && <EmailSetting />}
        {active === 3 && <PasswordSetting />}
        {active === 4 && <SecuritySetting />}
      </ComponentSection>
    </SettingContainer>
  );
};

export default Settings;
