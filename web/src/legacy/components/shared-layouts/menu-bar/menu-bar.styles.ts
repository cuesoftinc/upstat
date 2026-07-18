import { styled } from "styled-components";
import Link from "next/link";

export const MenuBarContainer = styled.section<{ $isMobileOpen: boolean; $isOpen: boolean }>`
  color: ${(props) => props.theme.colors.text.primary};
  background: ${(props) => props.theme.colors.surface.sidebar};
  display: flex;
  flex-direction: column;
  height: 100vh;
  flex-shrink: 0;    
  width: ${({ $isOpen }) => ($isOpen ? "260px" : "78px")};
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease;
  overflow: hidden;
  border-right: 1px solid ${(props) => props.theme.colors.border.subtle};
  z-index: 100;

 @media (max-width: 768px) {
    position: fixed;
    left: 0;
    top: 0;
    width: 280px;
    transform: ${({ $isMobileOpen }) => ($isMobileOpen ? "translateX(0)" : "translateX(-100%)")};
    box-shadow: ${({ $isMobileOpen }) => ($isMobileOpen ? "10px 0 30px rgba(0,0,0,0.25)" : "none")};
  }
`;

export const HeadSection = styled.div<{ $isOpen: boolean }>`
  display: flex;
  align-items: center;
  //justify-content: ${({ $isOpen }) => ($isOpen ? 'space-between' : 'center')};
  justify-content: space-between;
  //flex-direction: ${({ $isOpen }) => ($isOpen ? 'row' : 'column')};
  flex-direction: row;
  gap: ${({ $isOpen }) => ($isOpen ? '0' : '12px')};
  padding: 35px 20px;
  width: 100%;
  
svg {
  transition: ${(props) => props.theme.transitions.default};
  font-size: 20px;

  &:hover {
    transform: scale(1.1);
  }
}

@media (max-width: 768px) {
  display: none;
}
`;

export const ScrollableMenuContent = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 ${(props) => props.theme.spacing.sm} ${(props) => props.theme.spacing.lg};

  &::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none; 
  scrollbar-width: none; 
`;

export const MenuSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spacing.sm};
  padding: ${(props) => props.theme.spacing.sm} 0;
  border-top: 1px solid ${(props) => props.theme.colors.border.subtle};
  flex-shrink: 0;
`;

export const MenuTitle = styled.p`
  color: ${(props) => props.theme.colors.text.muted};
  text-align: left;
  font-weight: ${(props) => props.theme.typography.weights.bold};
  font-size: ${(props) => props.theme.typography.sizes.sm};
  padding-left: 12px;
  white-space: nowrap;
  overflow: hidden;
`;

export const MenuItem = styled(Link)<{ $isActive: boolean }>`
  display: flex;
  align-items: center;
  gap: ${(props) => props.theme.spacing.md};
  justify-content: start;
  padding: 15px 12px;
  border-radius: ${(props) => props.theme.borderRadius.md};
  background: ${({ $isActive, theme }) => ($isActive ? theme.colors.menu.itemActive : "transparent")};
  transition: ${(props) => props.theme.transitions.default};
  white-space: nowrap;
  
  &:hover {
    background: ${(props) => props.theme.colors.menu.itemHover};
  }

  p,
  svg {
    color: ${(props) => props.theme.colors.text.primary};
    white-space: nowrap;
    flex-shrink: 0;
  }
  
  svg {
    font-size: 20px;
  }
`;

export const LogoutItem = styled.button`
  background: ${(props) => props.theme.colors.surface.actionable || "#e11d48"};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  border: none;
  outline: none;
  padding: 15px; 
  width: 100%;
  border-radius: ${(props) => props.theme.borderRadius.md};
  cursor: pointer;
  transition: ${(props) => props.theme.transitions.default};

  &:hover {
    filter: brightness(1.1);
  }

  svg {
    color: #ffffff;
    font-size: 20px;
    flex-shrink: 0;
  }
`;

export const BackdropOverlay = styled.div<{ $visible: boolean }>`
  display: ${({ $visible }) => ($visible ? "block" : "none")};
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 90;
`;