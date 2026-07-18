"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import logo from '../../assets/logos/upstat-green.png'
import { Icon } from "@iconify/react";
import { PrimaryBtn, SecondaryBtn } from "@/components/ui/button/Button";
import {
  NavbarContainer,
  LogoWrapper,
  NavLinks,
  NavItem,
  NavActions,
  GitItem,
  HamburgerButton,
  MobileMenu,
  MobileNavItem,
  MobileNavActions,
  MobileGitItem
} from "./nav-bar.styles";

const navLinks = [
  { name: "Product", icon: "ph:caret-down-bold" },
  { name: "Solutions", icon: "ph:caret-down-bold" },
  { name: "Resources", icon: "ph:caret-down-bold" },
  { name: "Contact", icon: "ph:caret-down-bold" },
  { name: "Docs", icon: "" },
];

export default function Navbar() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogin = () => router.push("/login");
  const handleSignUp = () => router.push("/signup");
  const toggleMenu = () => setMenuOpen((prev) => !prev);

  return (
    <NavbarContainer>
      <LogoWrapper>
        <Image src={logo} alt="Upstat logo" height={56} width={122} />
      </LogoWrapper>

      <NavLinks>
        <GitItem>
          <Icon icon="mdi:github" />
          <p>18,439</p>
        </GitItem>
        {navLinks.map((link) => (
          <NavItem key={link.name}>
            <Link href="#">{link.name}</Link>
            {link.icon && <Icon icon={link.icon} />}
          </NavItem>
        ))}
      </NavLinks>

      <NavActions>
        <SecondaryBtn label="Login" onClick={handleLogin} />
        <PrimaryBtn label="Sign Up" onClick={handleSignUp} />
      </NavActions>

      {/* For Mobile Screen */}
      <HamburgerButton onClick={toggleMenu}>
        <Icon icon={menuOpen ? "ph:x-bold" : "ph:list-bold"} />
      </HamburgerButton>

      {menuOpen && (
        <MobileMenu>
          <MobileNavItem>
            <Icon icon="mdi:github" />
            <p>18,439</p>
          </MobileNavItem>
          {navLinks.map((link) => (
            <MobileNavItem key={link.name}>
              <Link href="#" onClick={toggleMenu}>{link.name}</Link>
              {link.icon && <Icon icon={link.icon} />}
            </MobileNavItem>
          ))}
          <MobileNavActions>
            <SecondaryBtn label="Login" onClick={handleLogin} />
            <PrimaryBtn label="Sign Up" onClick={handleSignUp} />
          </MobileNavActions>
        </MobileMenu>
      )}
    </NavbarContainer>
  );
}