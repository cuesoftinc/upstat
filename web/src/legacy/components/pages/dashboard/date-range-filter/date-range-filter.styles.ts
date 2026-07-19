import styled from "styled-components";

export const Wrapper = styled.div`
  position: relative;
  display: inline-block;
`;

export const Trigger = styled.button`
  display: flex;
  align-items: center;
  gap: ${(props) => props.theme.spacing.sm};
  background: ${(props) => props.theme.colors.surface.card};
  border: 1px solid ${(props) => props.theme.colors.border.subtle};
  border-radius: ${(props) => props.theme.borderRadius.md};
  padding: ${(props) => props.theme.spacing.sm} ${(props) => props.theme.spacing.lg};
  color: ${(props) => props.theme.colors.text.primary};
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-size: ${(props) => props.theme.typography.sizes.sm};
  font-weight: ${(props) => props.theme.typography.weights.medium};
  cursor: pointer;
  transition: ${(props) => props.theme.transitions.default};

  &:hover {
    border-color: ${(props) => props.theme.colors.brand};
  }

  @media (max-width: 480px) {
    padding: ${(props) => props.theme.spacing.xs} ${(props) => props.theme.spacing.md};
    font-size: ${(props) => props.theme.typography.sizes.xs};
  }
`;

export const ChevronIcon = styled.span<{ $isOpen: boolean }>`
  display: flex;
  transition: ${(props) => props.theme.transitions.default};
  transform: rotate(${({ $isOpen }) => ($isOpen ? "180deg" : "0deg")});
`;

export const Menu = styled.ul`
  position: absolute;
  top: calc(100% + ${(props) => props.theme.spacing.xs});
  left: 0;
  min-width: 160px;
  background: ${(props) => props.theme.colors.surface.card};
  border: 1px solid ${(props) => props.theme.colors.border.subtle};
  border-radius: ${(props) => props.theme.borderRadius.md};
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  padding: ${(props) => props.theme.spacing.xs};
  list-style: none;
  z-index: 20;

  @media (max-width: 480px) {
    min-width: 140px;
    left: auto;
    right: 0;
  }
`;

export const MenuItem = styled.li<{ $active: boolean }>`
  padding: ${(props) => props.theme.spacing.sm} ${(props) => props.theme.spacing.md};
  border-radius: ${(props) => props.theme.borderRadius.sm};
  font-size: ${(props) => props.theme.typography.sizes.sm};
  color: ${({ $active, theme }) =>
    $active ? theme.colors.brand : theme.colors.text.secondary};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.menu.itemActive : "transparent"};
  cursor: pointer;
  transition: ${(props) => props.theme.transitions.default};

  &:hover {
    background: ${(props) => props.theme.colors.menu.itemHover};
    color: ${(props) => props.theme.colors.text.primary};
  }
`;