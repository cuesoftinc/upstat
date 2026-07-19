import styled from "styled-components";

export const HeaderContainer = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 25px ${(props) => props.theme.spacing.section};
  
  background: transparent;
  border-bottom: 1px solid ${(props) => props.theme.colors.border.subtle};
  transition: ${(props) => props.theme.transitions.themeShift};
  gap: 20px;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
    padding: 20px;
    gap: 16px;
    background: ${(props) => props.theme.colors.surface.main};
  }
`;

export const MobileHeaderTopRow = styled.div`
  display: none;
  
  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
`;

export const HamburgerButton = styled.button`
  display: none;
  background: transparent;
  border: none;
  color: ${(props) => props.theme.colors.text.primary};
  font-size: 28px;
  cursor: pointer;
  
  @media (max-width: 768px) {
    display: block;
  }
`;

export const SearchWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: ${(props) => props.theme.colors.surface.sidebar};
  border: 0.5px solid ${(props) => props.theme.colors.border.subtle};
  border-radius: ${(props) => props.theme.borderRadius.md};
  padding: ${(props) => props.theme.spacing.md} ${(props) => props.theme.spacing.sm};
  flex-grow: 1;
  gap: ${(props) => props.theme.spacing.lg};
  margin: 0 30px;
  transition: ${(props) => props.theme.transitions.default};

  &:focus-within {
    border-color: ${(props) => props.theme.colors.brand};
    box-shadow: 0 0 0 1px ${(props) => props.theme.colors.brand};
  }

  svg {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.typography.sizes.lg};
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    margin: 0;
    width: 100%;
  }
`;

export const SearchInput = styled.input`
  background: transparent;
  border: none;
  outline: none;
  width: 100%;
  padding-left: ${(props) => props.theme.spacing.sm};
  color: ${(props) => props.theme.colors.text.primary};
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-size: ${(props) => props.theme.typography.sizes.sm};

  &::placeholder {
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export const ActionControlsSection = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: ${(props) => props.theme.spacing.xl};

  @media (max-width: 768px) {
  display: none; 
  }
`;

export const MobileRightActions = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  
  svg {
    font-size: 24px;
    color: ${(props) => props.theme.colors.text.primary};
  }
`;

export const UtilityButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${(props) => props.theme.spacing.lg};
  border-right: 2px solid ${(props) => props.theme.colors.border.subtle};
  border-left: 2px solid ${(props) => props.theme.colors.border.subtle};
  padding: 0px ${(props) => props.theme.spacing.lg};

  svg {
    color: ${(props) => props.theme.colors.text.primary};
    font-size: 22px;
    cursor: pointer;
    transition: ${(props) => props.theme.transitions.default};

    &:hover {
      color: ${(props) => props.theme.colors.brandAccent};
      transform: translateY(-1px);
    }
  }
`;

export const ProfileMenuWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${(props) => props.theme.spacing.md};
  cursor: pointer;
  user-select: none;
  position: relative;

  img {
    border-radius: ${(props) => props.theme.borderRadius.full};
    object-fit: cover;
    background: ${(props) => props.theme.colors.border.subtle};
  }
`;

export const MetaIdentityText = styled.div`
  display: flex;
  white-space: nowrap;
  flex-direction: column;
  font-family: ${(props) => props.theme.typography.fontFamily};

  h4 {
    color: ${(props) => props.theme.colors.text.primary};
    font-size: ${(props) => props.theme.typography.sizes.base};
    font-weight: ${(props) => props.theme.typography.weights.semibold};
    line-height: ${(props) => props.theme.typography.lineHeights.none};
    margin: 0 0 4px 0;
  }

  p {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.typography.sizes.base};
    font-weight: ${(props) => props.theme.typography.weights.regular};
    line-height: ${(props) => props.theme.typography.lineHeights.none};
    margin: 0;
  }
`;

export const ArrowDropdownIcon = styled.div`
  svg {
    color: ${(props) => props.theme.colors.text.muted};
    font-size: ${(props) => props.theme.typography.sizes.xl};
    transition: ${(props) => props.theme.transitions.default};
  }

  &:hover svg {
    color: ${(props) => props.theme.colors.text.primary};
  }
`;

export const FallbackAvatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${(props) => props.theme.borderRadius.full};
  background: ${(props) => props.theme.colors.brand};
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: ${(props) => props.theme.typography.weights.bold};
  font-size: ${(props) => props.theme.typography.sizes.sm};
  text-transform: uppercase;
`;