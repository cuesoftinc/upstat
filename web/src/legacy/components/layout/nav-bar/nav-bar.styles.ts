import { styled } from "styled-components";
import { theme } from '../../libs/theme'

const breakpoints = {
  mobile: "768px",
};

export const NavbarContainer = styled.header`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${theme.spacing.sm} ${theme.spacing.xl};
  background: ${theme.colors.background};
  border-bottom: 1px solid ${theme.colors.border};
  color: ${theme.colors.text};
  position: fixed;
  top: 0;
  z-index: 1000;
  flex-wrap: wrap;

  @media (max-width: ${breakpoints.mobile}) {
    padding: ${theme.spacing.sm};
  }
`;

export const LogoWrapper = styled.div`
  display: flex;
  align-items: center;
`;

export const NavLinks = styled.nav`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};

  @media (max-width: ${breakpoints.mobile}) {
    display: none;
  }
`;

export const NavItem = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: ${theme.colors.text};
  font-size: ${theme.fonts.sizes.md};

  &:hover {
    color: ${theme.colors.primary};
  }

  a {
    color: inherit;
  }
`;

export const GitItem = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  color: ${theme.colors.primary};
  font-size: ${theme.fonts.sizes.md};
`;

export const NavActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};

  @media (max-width: ${breakpoints.mobile}) {
    display: none;
  }
`;

// mobile screen 
export const HamburgerButton = styled.button`
  display: none;
  background: transparent;
  border: none;
  color: ${theme.colors.text};
  cursor: pointer;

  svg {
    width: 28px;
    height: 28px;
  }

  @media (max-width: ${breakpoints.mobile}) {
    display: flex;
    align-items: center;
  }
`;

export const MobileMenu = styled.div`
  display: none;
  flex-direction: column;
  width: 100%;
  padding: ${theme.spacing.sm};
  gap: ${theme.spacing.sm};
  background: ${theme.colors.background};
  border-top: 1px solid ${theme.colors.border};

  @media (max-width: ${breakpoints.mobile}) {
    display: flex;
  }
`;

export const MobileNavItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${theme.colors.text};
  font-size: ${theme.fonts.sizes.md};
  padding: ${theme.spacing.xs} 0;
  border-bottom: 1px solid ${theme.colors.border};
  cursor: pointer;

  a {
    color: inherit;
  }

  &:hover {
    color: ${theme.colors.primary};
  }
`;

export const MobileNavActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  margin-top: ${theme.spacing.sm};

  button {
    width: 100%;
  }
`;

export const MobileGitItem = styled.div`
  color: ${theme.colors.primary};
`;