import styled from "styled-components";

export const LoginContainer = styled.section`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: ${(props) => props.theme.colors.surface.main};
  color: ${(props) => props.theme.colors.text.primary};
  width: 100%;
  padding: 0 ${(props) => props.theme.spacing.md};
  transition: ${(props) => props.theme.transitions.themeShift};

  img {
    display: block;
    max-width: 50%;
    height: auto !important;
    object-fit: contain;
  }

  @media (max-width: 1024px) {
    img {
      max-width: 45%;
    }
  }

  @media (max-width: 768px) {
    flex-direction: column;
    padding: ${(props) => props.theme.spacing.lg} ${(props) => props.theme.spacing.md};
    justify-content: space-around;

    img {
      max-width: 280px;
      order: 2;
      align-self: center !important;
    }
  }

  @media (max-width: 480px) {
    justify-content: center;
    gap: ${(props) => props.theme.spacing.xl};

    img {
      display: none;
    }
  }
`;

export const FormSection = styled.div`
  display: flex;
  width: 40%;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: ${(props) => props.theme.spacing.lg};

  @media (max-width: 1024px) {
    width: 50%;
  }

  @media (max-width: 768px) {
    width: 100%;
    order: 1;
  }
`;

export const FormHeading = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(props) => props.theme.spacing.xs};
  text-align: center;
  font-family: ${(props) => props.theme.typography.fontFamily};

  h1 {
    font-weight: ${(props) => props.theme.typography.weights.bold};
    font-size: ${(props) => props.theme.typography.sizes.display};
  }

  p {
    font-weight: ${(props) => props.theme.typography.weights.regular};
    font-size: ${(props) => props.theme.typography.sizes.base};
    color: ${(props) => props.theme.colors.text.muted};
  }

  a {
    color: ${(props) => props.theme.colors.brand};
    font-weight: ${(props) => props.theme.typography.weights.medium};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  @media (max-width: 480px) {
    h1 {
      font-size: ${(props) => props.theme.typography.sizes.xl};
    }
    p {
      font-size: ${(props) => props.theme.typography.sizes.sm};
    }
  }
`;

export const GoogleBtn = styled.button`
  gap: ${(props) => props.theme.spacing.sm};
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-size: ${(props) => props.theme.typography.sizes.lg};
  font-weight: ${(props) => props.theme.typography.weights.regular};
  
  /* Adapts high-contrast button styling cleanly across mode themes */
  color: ${(props) => props.theme.colors.text.primary};
  background: transparent;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${(props) => props.theme.spacing.sm} ${(props) => props.theme.spacing.md};
  border: 1px solid ${(props) => props.theme.colors.text.primary};
  border-radius: ${(props) => props.theme.borderRadius.sm};
  cursor: pointer;
  transition: ${(props) => props.theme.transitions.default};
  width: 100%;
  max-width: 320px;

  &:hover {
    background: ${(props) => props.theme.isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)"};
  }

  &:active {
    transform: scale(0.98);
    background: ${(props) => props.theme.isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.1)"};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 480px) {
    font-size: ${(props) => props.theme.typography.sizes.base};
    padding: ${(props) => props.theme.spacing.sm};
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