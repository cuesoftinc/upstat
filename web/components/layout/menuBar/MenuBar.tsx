"use client";

import Image from "next/image";
import logo from '../../assets/logos/upstat-vector.png';
import { Icon } from "@iconify/react";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  MenuBarContainer,
  HeadSection,
  ScrollableMenuContent,
  MenuSection,
  LogoutItem,
  MenuTitle,
  MenuItem,
  BackdropOverlay
} from "./MenuBar.styles";
import { accountData, menudata } from "@/components/constants/menuBar.data";
import { useRouter } from "next/navigation";

interface MenuBarProps {
  isMobileOpen: boolean;
  closeMobileMenu: () => void;
}

const MenuBar = ({ isMobileOpen, closeMobileMenu }: MenuBarProps) => {
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    closeMobileMenu();
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  };

  return (
    <>
      <BackdropOverlay $visible={isMobileOpen} onClick={closeMobileMenu} />
      
      <MenuBarContainer $isMobileOpen={isMobileOpen} $isOpen={isOpen}>
        <HeadSection $isOpen={isOpen}>
          <div style={{ display: "flex", alignItems: "center", gap: isOpen ? "12px" : "0px" }}>
            <Image src={logo} alt="logo" width={32} height={32} style={{ flexShrink: 0 }} />
            {(isOpen || isMobileOpen) && <span>Upstat</span>}
          </div>
          <Icon
            icon={`ri:arrow-${isOpen ? "left" : "right"}-double-line`}
            onClick={() => setIsOpen(!isOpen)}
            style={{ cursor: "pointer", flexShrink: 0 }}
          />
        </HeadSection>

        <ScrollableMenuContent>
          <MenuSection>
            <MenuTitle>{(isOpen || isMobileOpen) ? "MENU" : "•"}</MenuTitle>
            {menudata.map((el) => (
              <MenuItem href={el.path} key={el.id} $isActive={pathname === el.path}>
                <Icon icon={el.icon} />
                {(isOpen || isMobileOpen) && <p>{el.name}</p>}
              </MenuItem>
            ))}
          </MenuSection>

          <MenuSection>
            <MenuTitle>{(isOpen || isMobileOpen) ? "ACCOUNTS" : "•"}</MenuTitle>
            {accountData.map((el) => (
              <MenuItem href={el.path} key={el.id} $isActive={pathname === el.path}>
                <Icon icon={el.icon} />
                {(isOpen || isMobileOpen) && <p>{el.name}</p>}
              </MenuItem>
            ))}
          </MenuSection>

          <MenuSection>
            <LogoutItem onClick={handleLogout}>
              <Icon icon="majesticons:logout" />
              {/* {(isOpen || isMobileOpen) && <p style={{ color: "#ffffff", margin: 0 }}>Log out</p>} */}
            </LogoutItem>
          </MenuSection>
        </ScrollableMenuContent>
      </MenuBarContainer>
    </>
  );
};

export default MenuBar;