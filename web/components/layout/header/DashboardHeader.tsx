"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { useApp } from "@/components/contexts/AppContext";
import {
  HeaderContainer,
  MobileHeaderTopRow,
  HamburgerButton,
  SearchWrapper,
  SearchInput,
  ActionControlsSection,
  MobileRightActions,
  UtilityButtonGroup,
  ProfileMenuWrapper,
  MetaIdentityText,
  ArrowDropdownIcon,
  FallbackAvatar,
} from "./DashboardHeader.styles";

interface DashboardHeaderProps {
  onMenuToggle: () => void;
}

export default function DashboardHeader({ onMenuToggle }: DashboardHeaderProps) {
  const { state, dispatch } = useApp();
  const [searchQuery, setSearchQuery] = useState<string>("");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const userInitial = state.user.name.charAt(0) || "U";

  // Reusable Identity rendering block
  const identityBlock = (
    <ProfileMenuWrapper>
      {state.user.avatarUrl ? (
        <Image
          src={state.user.avatarUrl}
          alt={state.user.name}
          width={40}
          height={40}
          priority
        />
      ) : (
        <FallbackAvatar>{userInitial}</FallbackAvatar>
      )}
      
      <MetaIdentityText>
        <h4>{state.user.name}</h4>
        <p>{state.user.role}</p>
      </MetaIdentityText>
    </ProfileMenuWrapper>
  );

  return (
    <HeaderContainer>
      {/* 1. MOBILE RESPONSIVE TOP ROW (Shows under 768px matching iPhone Mini mockups) */}
      <MobileHeaderTopRow>
        {identityBlock}
        <MobileRightActions>
          <Icon 
            icon={state.isDarkMode ? "lucide:moon" : "lucide:sun"} 
            onClick={() => dispatch({ type: "TOGGLE_THEME" })}
          />
          <HamburgerButton onClick={onMenuToggle}>
            <Icon icon="lucide:menu" />
          </HamburgerButton>
        </MobileRightActions>
      </MobileHeaderTopRow>

      {/* 2. DYNAMIC SEARCH COMPONENT (Grows on desktop, full-width on mobile) */}
      <SearchWrapper>
        <SearchInput
          type="text"
          placeholder="Search"
          value={searchQuery}
          onChange={handleSearchChange}
        />
        <Icon icon="lucide:search" />
      </SearchWrapper>

      {/* 3. DESKTOP ACTION SECTION (Hidden on mobile) */}
      <ActionControlsSection>
        <UtilityButtonGroup>
          <Icon icon="lucide:bell" />
          <Icon 
            icon={state.isDarkMode ? "lucide:moon" : "lucide:sun"} 
            onClick={() => dispatch({ type: "TOGGLE_THEME" })}
          />
        </UtilityButtonGroup>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {identityBlock}
          <ArrowDropdownIcon>
            <Icon icon="lucide:more-horizontal" />
          </ArrowDropdownIcon>
        </div>
      </ActionControlsSection>
    </HeaderContainer>
  );
}