import { styled } from "styled-components";
import { theme } from "@/components/libs/theme";

const breakpoints = {
  mobile: "768px",
  tablet: "1024px",
};

export const WorkflowContainer = styled.section`
  width: 100%;
  background: ${theme.colors.background};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${theme.spacing.xxl} ${theme.spacing.xl};
  gap: 48px;
  overflow-x: hidden;

  @media (max-width: ${breakpoints.mobile}) {
    padding: ${theme.spacing.xl} ${theme.spacing.md};
    gap:  ${theme.spacing.lg}
  }
`;

export const WorkflowHeader = styled.h2`
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

export const WorkflowTitleGreen = styled.span`
  color: ${theme.colors.green.normal};
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.semibold};
`;

export const GridContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${theme.spacing.lg};
  width: 100%;
  max-width: 1200px;

  @media (max-width: ${breakpoints.tablet}) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: ${breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: ${theme.spacing.md};
  }
`;

export const Card = styled.div`
  background: ${theme.colors.grey.normal};
  border-radius: 12px;
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;

  &:hover {
    transform: translateY(-4px);
  }

  @media (max-width: ${breakpoints.mobile}) {
    padding: 32px 24px;
  }
`;

export const IconCircle = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: rgba(16, 185, 129, 0.15); 
  border: 1px solid ${theme.colors.green.normal};
  color: ${theme.colors.green.normal};
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 24px;
  flex-shrink: 0;
`;

export const CardTitle = styled.h3`
  font-size: 20px;
  font-weight: ${theme.fonts.weights.semibold};
  font-family: ${theme.fonts.family};
  color: ${theme.colors.text};
  margin-bottom: 16px;
  line-height: 1.3;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: 18px;
  }
`;

export const CardDescription = styled.p`
  font-size: 14px;
  font-weight: ${theme.fonts.weights.regular};
  font-family: ${theme.fonts.family};
  color: ${theme.colors.textMuted};
  line-height: 1.6;
  max-width: 320px;
`;
