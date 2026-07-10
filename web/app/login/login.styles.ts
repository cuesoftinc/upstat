import styled from "styled-components";

export const LoginContainer = styled.section`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 100vh; 
  max-height: 100vh;
  
  background: ${(props) => props.theme.colors.surface.main};
  color: ${(props) => props.theme.colors.text.primary};
  padding: 0 max(4vw, ${(props) => props.theme.spacing.xl});
  box-sizing: border-box;
  transition: ${(props) => props.theme.transitions.themeShift};
  overflow: hidden; 
  .login-illustration {
    display: block;
    max-width: 50%;
    width: auto;
    height: auto;
    max-height: 85vh; 
      object-fit: contain;
    align-self: flex-end;
  }

  @media (max-width: 968px) {
    flex-direction: column;
    justify-content: center;
    align-items: center;
    
    height: auto;
    min-height: 100vh;
    max-height: none;
    overflow-y: auto; 
    
    padding: ${(props) => props.theme.spacing.xxl} ${(props) => props.theme.spacing.lg};
    gap: ${(props) => props.theme.spacing.xl};

    .login-illustration {
      max-width: 85%;
      width: 320px;
      max-height: 40vh;
      align-self: center;
    }
  }

  @media (max-width: 480px) {
    padding: ${(props) => props.theme.spacing.xl} ${(props) => props.theme.spacing.md};
    gap: ${(props) => props.theme.spacing.lg};

    .login-illustration {
      width: 260px;
    }
  }
`;

export const FormSection = styled.div`
  display: flex;
  width: 45%;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: ${(props) => props.theme.spacing.xl};
  box-sizing: border-box;

  @media (max-width: 968px) {
    width: 100%;
    max-width: 420px;
  }
`;

export const FormHeading = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spacing.sm};
  text-align: center;
  font-family: ${(props) => props.theme.typography.fontFamily};
  width: 100%;

  h1 {
    margin: 0;
    font-weight: ${(props) => props.theme.typography.weights.bold};
    font-size: calc(${(props) => props.theme.typography.sizes.display} * 0.85);
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    font-weight: ${(props) => props.theme.typography.weights.regular};
    font-size: ${(props) => props.theme.typography.sizes.base};
    color: ${(props) => props.theme.colors.text.muted};
    line-height: 1.5;
  }

  @media (max-width: 480px) {
    h1 {
      font-size: ${(props) => props.theme.typography.sizes.xxl};
    }
    p {
      font-size: ${(props) => props.theme.typography.sizes.sm};
    }
  }
`;

export const GoogleBtn = styled.button`
  gap: ${(props) => props.theme.spacing.md};
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-size: ${(props) => props.theme.typography.sizes.base};
  font-weight: ${(props) => props.theme.typography.weights.medium};
  color: ${(props) => props.theme.colors.text.primary};
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${(props) => props.theme.spacing.md};
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: ${(props) => props.theme.borderRadius.md};
  cursor: pointer;
  transition: ${(props) => props.theme.transitions.default};
  width: 100%;
  box-sizing: border-box;

  svg {
    font-size: 1.25rem;
  }

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 255, 255, 0.3);
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
    background: rgba(255, 255, 255, 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const HiddenGoogleButtonWrapper = styled.div`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
`;