import { styled } from "styled-components";
import { theme } from "@/components/libs/theme";

const breakpoints = {
  mobile: "768px",
};

export const BusinessContainer = styled.section`
  width: 100%;
  background: ${theme.colors.background};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${theme.spacing.xxl} ${theme.spacing.xl};
  gap: ${theme.spacing.xl};
  overflow-x: hidden;

  @media (max-width: ${breakpoints.mobile}) {
    padding: ${theme.spacing.xl} ${theme.spacing.md};
    gap: ${theme.spacing.lg};
  }
`;

export const BusinessHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
`;

export const BusinessTitle = styled.h2`
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: ${theme.colors.text};
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.semibold};
  font-size: 48px;
  line-height: 120%;
  letter-spacing: -0.5px;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: 28px;
    flex-wrap: wrap;
  }
`;

export const BusinessTitleGreen = styled.span`
  color: ${theme.colors.primary}; /* Uses your theme's green hex: #00A991 */
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.semibold};
`;

export const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${theme.spacing.lg};
  width: 100%;
  max-width: 1200px;

  @media (max-width: ${breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: ${theme.spacing.md};
  }
`;

export const Card = styled.div`
  background: ${theme.colors.backgroundSecondary}; /* Uses your theme's card color: #1E1D26 */
  border-radius: ${theme.borderRadius.md};
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: 0px 4px 24px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0px 6px 30px rgba(0, 0, 0, 0.25);
  }

  @media (max-width: ${breakpoints.mobile}) {
    padding: 32px 24px;
  }
`;

export const CardTitle = styled.h3`
  font-size: ${theme.fonts.sizes.lg};
  font-weight: ${theme.fonts.weights.semibold};
  font-family: ${theme.fonts.family};
  color: ${theme.colors.text};
  margin-bottom: ${theme.spacing.sm};
  line-height: 1.3;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: ${theme.fonts.sizes.md};
  }
`;

export const CardDescription = styled.p`
  font-size: 14px;
  font-weight: ${theme.fonts.weights.regular};
  font-family: ${theme.fonts.family};
  color: ${theme.colors.white.dark}; /* Uses your theme's muted white variant */
  line-height: 1.6;
  max-width: 480px;
  opacity: 0.9;
`;
