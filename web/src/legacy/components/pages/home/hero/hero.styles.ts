import { styled } from "styled-components";
import { theme } from "@/components/libs/theme";
import { TextBtn } from "@/components/ui/button/Button";
const breakpoints = {
  mobile: "768px",
};

export const HeroContainer = styled.section`
  width: 100%;
  background: ${theme.colors.background};
  color: ${theme.colors.text};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${theme.spacing.xxl} ${theme.spacing.xl};
  margin-top:${theme.spacing.xxl};
  gap: ${theme.spacing.sm};
  overflow-x: hidden;

  @media (max-width: ${breakpoints.mobile}) {
    padding: ${theme.spacing.xl} ${theme.spacing.sm};
  }
`;

export const HeroContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 1080px;
`;

export const HeroTitle = styled.h1`
  font-size: ${theme.fonts.sizes.hero};
  font-weight: ${theme.fonts.weights.semibold};
  line-height: 1.2;
  font-family: ${theme.fonts.family};

  @media (max-width: ${breakpoints.mobile}) {
    font-size: ${theme.fonts.sizes.xxl};
  }
`;

export const HeroAccent = styled.span`
  color: ${theme.colors.primary};
`;

export const HeroSubtitle = styled.p`
  font-size: ${theme.fonts.sizes.lg};
  color: ${theme.colors.text};
  line-height: 1.6;
  max-width: 890px;
  padding: ${theme.spacing.sm} ${theme.spacing.xl};
  font-weight: ${theme.fonts.weights.regular};

  @media (max-width: ${breakpoints.mobile}) {
    font-size: ${theme.fonts.sizes.sm};
    padding: ${theme.spacing.sm} ${theme.spacing.sm};
  }
`;

export const HeroActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  margin-top: ${theme.spacing.sm};

  @media (max-width: ${breakpoints.mobile}) {
    flex-direction: column;
    width: 100%;

    button {
      width: 60%;
      max-width: 198px;
    }
  }
`;

export const ToolsBar = styled.div`
  display: flex;
  width: 100%;
  justify-content: space-between;
  background-color: ${theme.colors.border};
  margin: ${theme.spacing.xxl} 0;
  align-items: center;
 border-radius: ${theme.borderRadius.sm};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  gap: ${theme.spacing.sm};
  overflow: hidden;

  @media (max-width: ${breakpoints.mobile}) {
    flex-direction: row;
    overflow: auto;
    align-items: center;
     scrollbar-width: none;

       &::-webkit-scrollbar {
      display: none;
    }
  }
`;

export const ToolsScroll = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.lg};
  overflow-x: auto;
  flex-wrap: nowrap;             
  scrollbar-width: none;
  flex: 1;

  &::-webkit-scrollbar {
    display: none;
  }
`;

export const ToolItem = styled.span`
  font-size: ${theme.fonts.sizes.md};
  color: ${theme.colors.textMuted};
  font-weight: ${theme.fonts.weights.medium};
  white-space: nowrap;
  cursor: pointer;
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  border-radius: ${theme.borderRadius.sm};

  &:hover {
    color: ${theme.colors.text};
  }
`;

export const ActiveToolItem = styled(ToolItem)`
  background: ${theme.colors.background};
  color: ${theme.colors.text};
  font-weight: ${theme.fonts.weights.medium};

  &:hover {
    color: ${theme.colors.text};
    opacity: 0.9;
  }
`;

export const ViewMore = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: ${theme.colors.textMuted};
  font-size: ${theme.fonts.sizes.sm};
  white-space: nowrap;
  cursor: pointer;
  font-family: ${theme.fonts.family};
  text-decoration: underline;

  &:hover {
    color: ${theme.colors.text};
  }
`;

export const TextButton = styled(TextBtn)`
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: ${theme.colors.textMuted};
  font-size: ${theme.fonts.sizes.sm};
  white-space: nowrap;
  cursor: pointer;
  font-family: ${theme.fonts.family};
  text-decoration: underline;

  &:hover {
    color: ${theme.colors.text};
  }
`;