"use client";
import React, { useState } from "react";
import AccountInfo from "@/components/setting/AccountInfo/AccountInfo";
import {
  ComponentSection,
  SettingContainer,
  TabButton,
  TabHeader,
} from "./page.styles";
import { Icon } from "@iconify/react";
import EmailSetting from "@/components/setting/EmailSetting/EmailSetting";
import PswdSetting from "@/components/setting/PswdSetting/PswdSetting";
import SecuritySetting from "@/components/setting/SecuritySetting/SecuritySetting";
import { ProtectedRoute } from "@/components/otherComponents/protectRoute/ProtectedRoute";

const Settings = () => {
  const [active, setActive] = useState(1);

  const handleTab = (ev: number) => {
    setActive(ev);
  };
  return (
    <ProtectedRoute>
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
          {active === 3 && <PswdSetting />}
          {active === 4 && <SecuritySetting />}
        </ComponentSection>
      </SettingContainer>
    </ProtectedRoute>
  );
};

export default Settings;
