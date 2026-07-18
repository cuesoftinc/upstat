import { styled } from "styled-components";
import { theme } from "@/components/libs/theme";

const breakpoints = {
  mobile: "768px",
};

export const CustomersContainer = styled.section`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: ${theme.colors.background};
  color: ${theme.colors.text};
  padding: ${theme.spacing.xl} ${theme.spacing.xl};
  gap: ${theme.spacing.lg};
  overflow-x: hidden;

  @media (max-width: ${breakpoints.mobile}) {
    padding: ${theme.spacing.xl} ${theme.spacing.sm};
    gap: ${theme.spacing.sm};
  }
`;

export const DashboardWrapper = styled.div`
  width: 100%;
  max-width: 1022px;
  border-radius: ${theme.borderRadius.lg};
  overflow: hidden;
`;

export const Description = styled.p`
  font-size: ${theme.fonts.sizes.md};
  color: ${theme.colors.text};
  font-weight: ${theme.fonts.weights.medium}
  text-align: center;
  max-width: 1174px;
  line-height: 1.6;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: ${theme.fonts.sizes.sm};
    text-align: center;
  }
`;

export const LogosScroll = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${theme.spacing.xl};
  flex-wrap: wrap;

  @media (max-width: ${breakpoints.mobile}) {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    width: 100%;
    padding-bottom: ${theme.spacing.sm};
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

export const LogoItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
  }
`;

export const CTAWrapper = styled.div`
  display: flex;
  justify-content: center;
  padding-top: ${theme.spacing.lg};
  color: ${theme.colors.textMuted}
  width: 100%;
`;