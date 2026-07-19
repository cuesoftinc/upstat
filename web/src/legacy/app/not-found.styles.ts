import styled from "styled-components";
import { theme } from "@/components/libs/theme";

export const SignupContainer = styled.section`
  display: flex;
  color: ${theme.colors.text};
  background: ${theme.colors.background}; 
  width: 100%;
  height: 100vh;
`;

export const TextContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: ${theme.spacing.md};
  font-family: ${theme.fonts.family};
  font-size: ${theme.fonts.sizes.md};
  margin: auto;
`;

export const BorderedText = styled.p`
  display: flex;
  padding-right: ${theme.spacing.md};
  border-right: 1px solid ${theme.colors.white.light};
  font-size: ${theme.fonts.sizes.lg};
`;