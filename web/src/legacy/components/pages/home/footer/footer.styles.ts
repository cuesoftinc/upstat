import { styled } from "styled-components";
import { theme } from "@/components/libs/theme";
import { TextBtn } from "@/components/ui/button/Button"; 

const breakpoints = {
  mobile: "768px",
  tablet: "1024px",
};

export const FooterContainer = styled.footer`
  width: 100%;
  background: ${theme.colors.primary};
  color: ${theme.colors.text};
  padding: 80px ${theme.spacing.xl} 40px ${theme.spacing.xl};
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-x: hidden;

  @media (max-width: ${breakpoints.mobile}) {
    padding: 48px ${theme.spacing.md} 32px ${theme.spacing.md};
  }
`;

export const MainContentRow = styled.div`
  width: 100%;
  max-width: 1200px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 48px;

  @media (max-width: ${breakpoints.tablet}) {
    flex-direction: column;
    gap: 40px;
  }
`;

export const BrandColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 353px;
  gap: ${theme.spacing.sm};

  @media (max-width: ${breakpoints.tablet}) {
    max-width: 100%;
  }
`;

export const BrandDescription = styled.p`
  font-family: ${theme.fonts.family};
  font-size: ${theme.fonts.sizes.md};
  font-weight: ${theme.fonts.weights.regular};
  line-height: 1.6;
  color: ${theme.colors.text};
  letter-spacing: 8;
`;

export const LinksGrid = styled.div`
  display: flex;
  gap: 64px;

  @media (max-width: ${breakpoints.tablet}) {
    width: 100%;
    justify-content: space-between;
    gap: 32px;
  }

  @media (max-width: ${breakpoints.mobile}) {
    display: flex;
    flex-direction: column;
    // grid-template-columns: repeat(2, 1fr);
    gap: 32px 24px;
  }
`;

export const LinksColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px; /* Reduced to balance out internal padding inside TextBtn */
`;

export const ColumnTitle = styled.h4`
  font-family: ${theme.fonts.family};
  font-size: ${theme.fonts.sizes.lg};
  font-weight: ${theme.fonts.weights.semibold};
  color: ${theme.colors.text};
  margin-bottom: 12px;

   @media (max-width: ${breakpoints.mobile}) {
   font-size: ${theme.fonts.sizes.md};
   }
`;

export const FooterLinkWrapper = styled.div`
  button {
    font-family: ${theme.fonts.family} !important;
    font-size: 14px !important;
    font-weight: ${theme.fonts.weights.regular} !important;
    background: transparent !important;
    border: none !important;
    padding: 4px 0 !important;
    text-align: left !important;
    cursor: pointer;
    transition: color 0.2s ease, transform 0.2s ease;

    &:hover {
      color: ${theme.colors.text} !important;
      transform: translateX(2px);
    }
  }
`;

export const ContactItem = styled.a`
  font-family: ${theme.fonts.family};
  font-size: ${theme.fonts.sizes.sm};
  font-weight: ${theme.fonts.weights.regular};
  color: ${theme.colors.text};
  text-decoration: none;
  padding: 4px 0;
  transition: color 0.2s ease;

  &:hover {
    color: ${theme.colors.text};
  }

   @media (max-width: ${breakpoints.mobile}) {
   font-size: ${theme.fonts.sizes.sm};
   }
`;

export const TextButton = styled(TextBtn)`
  font-family: ${theme.fonts.family};
  font-size: ${theme.fonts.sizes.sm};
  font-weight: ${theme.fonts.weights.regular};
  color: ${theme.colors.text};
  text-decoration: none;
  padding: 4px 0;
  transition: color 0.2s ease;

  &:hover {
    color: ${theme.colors.text};
  }

   @media (max-width: ${breakpoints.mobile}) {
   font-size: ${theme.fonts.sizes.sm};
   }
`;

export const BottomDivider = styled.div`
  width: 100%;
  max-width: 1200px;
  height: 1px;
  background-color: rgba(255, 255, 255, 0.2);
  margin: 48px 0 24px 0;

  @media (max-width: ${breakpoints.mobile}) {
    margin: 40px 0 24px 0;
  }
`;

export const BottomRow = styled.div`
  width: 100%;
  max-width: 1200px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  @media (max-width: ${breakpoints.mobile}) {
    flex-direction: column-reverse;
    gap: 24px;
    align-items: flex-start;
  }
`;

export const CopyrightText = styled.span`
  font-family: ${theme.fonts.family};
  font-size: 14px;
  font-weight: ${theme.fonts.weights.regular};
  color: rgba(255, 255, 255, 0.9);
`;

export const SocialLinksGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const SocialIconCircle = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: ${theme.colors.text};
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(255, 255, 255, 0.1);
    border-color: ${theme.colors.text};
  }
`;
