import { styled } from "styled-components";
import { theme } from "@/components/libs/theme";

const breakpoints = {
  mobile: "768px",
  tablet: "1024px",
};

export const CommunityContainer = styled.section`
  width: 100%;
  background: ${theme.colors.background};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${theme.spacing.xxl} ${theme.spacing.xl};
  gap: 40px;
  overflow-x: hidden;

  @media (max-width: ${breakpoints.mobile}) {
    padding: ${theme.spacing.xl} ${theme.spacing.md};
    gap: ${theme.spacing.lg};
  }
`;

export const CommunityHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;

`;

export const CommunityTitle = styled.h2`
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: ${theme.colors.text};
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.semibold};
  font-size: 48px;
  line-height: 130%;
  letter-spacing: -0.5px;
max-width: 867px;
flex-wrap: wrap;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: 28px;
    flex-wrap: wrap;
  }
`;

export const CommunityTitleGreen = styled.span`
  color: ${theme.colors.primary};
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.semibold};
`;


export const FeaturedBanner = styled.div`
  background: linear-gradient(135deg, ${theme.colors.primary} 0%, #008774 100%);
  border-radius: ${theme.borderRadius.lg};
  width: 100%;
  max-width: 1295px;
  display: flex;
  justify-content: space-between;
  align-items: center;
//   padding: 56px 64px;
  padding-right: 0;
  padding-bottom: 0;
  position: relative;
  overflow: hidden;
  box-shadow: 0px 10px 30px rgba(0, 0, 0, 0.2);

    @media (max-width: ${breakpoints.tablet}) {
    padding: 40px;
  }

  @media (max-width: ${breakpoints.mobile}) {
    flex-direction: column;
    align-items: flex-start; 
    text-align: left; 
    gap: 40px;
    padding: 32px 0 0 24px; 
  }
`;

export const BannerContent = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 838px;
//   padding-bottom: ${theme.spacing.xl};
padding: 56px 64px;
  z-index: 2;

    @media (max-width: ${breakpoints.mobile}) {
    width: 100%;
  }
`;

export const BannerTitle = styled.h3`
  font-size: 48px;
  font-weight: ${theme.fonts.weights.semibold};
  font-family: ${theme.fonts.family};
  color: ${theme.colors.text};
  margin-bottom: 28px;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: ${theme.fonts.sizes.lg};
    margin-bottom: 16px;
  }
`;

export const BannerDescription = styled.p`
  font-size: ${theme.fonts.sizes.lg};
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.regular};
  color: ${theme.colors.text};
  line-height: 1.6;
//   max-width: 838px;

@media (max-width: ${breakpoints.mobile}) {
    font-size: ${theme.fonts.sizes.sm};
    padding-right: ${theme.spacing.md};
  }

`;


export const BannerImageWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  position: relative;
  margin-right: -80px;
  margin-bottom: -90px; 
  z-index: 1;

  img {
    max-width: 340px;
    height: auto;
  }

  @media (max-width: ${breakpoints.tablet}) {
    margin-right: 0;
    img {
      max-width: 260px;
    }
  }

  @media (max-width: ${breakpoints.mobile}) {
  justify-content: end;
    margin: 0 auto;
    margin-right: -20px;
    margin-bottom:
    width: 100%;
    img {
    display: flex;
    justify-content: flex-end;
      max-width: 280px; 
      width: 100% !important;
      height: auto !important;
    }
  }
`;


export const BottomGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${theme.spacing.lg};
  width: 100%;
  max-width: 1295px;

  @media (max-width: ${breakpoints.mobile}) {
    grid-template-columns: 1fr;
    gap: ${theme.spacing.md};
  }
`;

export const InfoCard = styled.div`
  background: ${theme.colors.backgroundSecondary};
  border-radius: ${theme.borderRadius.md};
  padding: 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 240px;
  box-shadow: 0px 4px 20px rgba(0, 0, 0, 0.15);

  @media (max-width: ${breakpoints.mobile}) {
    padding: 32px 24px;
    gap: 24px;
    min-height: auto;
  }
`;

export const CardTitle = styled.h4`
  font-size: 18px;
  font-weight: ${theme.fonts.weights.semibold};
  font-family: ${theme.fonts.family};
  color: ${theme.colors.text};
  margin-bottom: 12px;
  line-height: 1.4;
`;

export const CardDescription = styled.p`
  font-size: 14px;
  font-family: ${theme.fonts.family};
  color: ${theme.colors.white.dark};
  line-height: 1.6;
  margin-bottom: 32px;

  @media (max-width: ${breakpoints.mobile}) {
    margin-bottom: 16px;
  }
`;

export const CardFooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-top: auto;

  @media (max-width: ${breakpoints.mobile}) {
    flex-direction: column;
    align-items: center;
    gap: 20px;
  }
`;

export const SocialIconGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const SocialIconLink = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: ${theme.colors.text};
  transition: all 0.2s ease;

  &:hover {
    border-color: ${theme.colors.primary};
    color: ${theme.colors.primary};
    background: rgba(0, 169, 145, 0.05);
  }
`;

export const ActionButton = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background-color: ${theme.colors.primary};
  color: ${theme.colors.text};
  font-family: ${theme.fonts.family};
  font-size: 14px;
  font-weight: ${theme.fonts.weights.medium};
  padding: 10px 20px;
  border-radius: ${theme.borderRadius.sm};
  text-decoration: none;
  transition: background-color 0.2s ease;
  white-space: nowrap;

  &:hover {
    background-color: ${theme.colors.green.normalHover};
  }

  @media (max-width: ${breakpoints.mobile}) {
    width: max-content;
    justify-content: center;
  }
`;
