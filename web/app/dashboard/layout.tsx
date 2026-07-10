"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "styled-components";
import { AppProvider } from "@/components/contexts/AppContext";
import { QueryProvider } from "@/components/contexts/QueryProvider";
import MenuBar from "@/components/layout/menuBar/MenuBar";
import DashboardHeader from "@/components/layout/header/DashboardHeader";
import { darkTheme } from "@/components/libs/theme2";
import styled from "styled-components";
import { Icon } from "@iconify/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { menudata } from "@/components/constants/menuBar.data";

const DashboardLayoutWrapper = styled.div`
  display: flex;
  width: 100%;
  height: 100vh;      
  overflow: hidden;   
  background-color: ${(props) => props.theme.colors.surface.main};
  transition: ${(props) => props.theme.transitions.themeShift};
  position: relative;
`;

const MainContentCanvas = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;       
  height: 100%;       
  width: 0;
  overflow: hidden;
`;

const ScrollableDashboardBody = styled.main`
width: 100%;
min-width: 0;
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: ${(props) => props.theme.spacing.xl};
  padding-bottom: 100px;
  
  @media (max-width: 768px) {
    padding: ${(props) => props.theme.spacing.lg};
    padding-bottom: 90px;
  }
`;

const MobileBottomNavBar = styled.nav`
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 65px;
  background: ${(props) => props.theme.colors.surface.sidebar};
  border-top: 1px solid ${(props) => props.theme.colors.border.subtle};
  justify-content: space-around;
  align-items: center;
  z-index: 99;

  @media (max-width: 768px) {
    display: flex;
  }
`;

const BottomNavItem = styled(Link)<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: ${({ $active, theme }) => ($active ? theme.colors.brand : theme.colors.text.muted)};
  font-size: 24px;
  transition: ${(props) => props.theme.transitions.default};
`;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const pathname = usePathname();

  return (
    <SessionProvider>
      <QueryProvider>
      <ThemeProvider theme={darkTheme}>
        <AppProvider>
          <DashboardLayoutWrapper>
            <MenuBar isMobileOpen={isMobileMenuOpen} closeMobileMenu={() => setIsMobileMenuOpen(false)} />
            
            <MainContentCanvas>
              <DashboardHeader onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
              <ScrollableDashboardBody>
                {children}
              </ScrollableDashboardBody>
            </MainContentCanvas>

            <MobileBottomNavBar>
              {menudata.slice(0, 4).map((item) => (
                <BottomNavItem 
                  href={item.path} 
                  key={item.id} 
                  $active={pathname === item.path}
                >
                  <Icon icon={item.icon} />
                </BottomNavItem>
              ))}
            </MobileBottomNavBar>
          </DashboardLayoutWrapper>
        </AppProvider>
      </ThemeProvider>
      </QueryProvider>
    </SessionProvider>
  );
}