import { styled } from "styled-components";
import { theme } from "@/components/libs/theme";
import { PrimaryBtn } from "@/components/ui/button/Button";

const breakpoints = {
  mobile: "768px",
};

export const DeveloperContainer = styled.section`
  width: 100%;
  background: ${theme.colors.background};
  color: ${theme.colors.text};
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${theme.spacing.xxl} ${theme.spacing.xl};
  gap: ${theme.spacing.xxl};
  overflow-x: hidden;

  @media (max-width: ${breakpoints.mobile}) {
    padding: ${theme.spacing.xl} ${theme.spacing.md};
    gap: ${theme.spacing.xl};
  }
`;

export const DeveloperHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${theme.spacing.md};
`;

export const DeveloperTitle = styled.div`
  display: flex;
  align-items: center;
  text-align: center;
  color: ${theme.colors.text};
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.semibold};
  font-size: 48px;
  line-height: 100%;
  letter-spacing: 1;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: 28px;
    flex-wrap: wrap;
    justify-content: center;
  }
`;

export const DeveloperTitleGreen = styled.div`
  display: flex;
  align-items: center;
  text-align: center;
  color: ${theme.colors.green.normal};
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.semibold};
  font-size: 48px;
  line-height: 100%;
  letter-spacing: 1;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: 28px;
  }
`;

export const DeveloperSubtitle = styled.p`
  font-size: ${theme.fonts.sizes.xl};
  color: ${theme.colors.white.dark};
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.medium};

  @media (max-width: ${breakpoints.mobile}) {
    font-size: ${theme.fonts.sizes.sm};
    max-width: 280px;
    line-height: 1.4;
  }
`;

export const FeatureBlock = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  width: 100%;
  max-width: 1200px;
  position: relative;

  @media (max-width: ${breakpoints.mobile}) {
    gap: ${theme.spacing.sm};
  }
`;

export const FeatureIconWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  position: relative;

  @media (max-width: ${breakpoints.mobile}) {
    margin-bottom: -10px;
    img {
      max-height: 100px;
      width: auto;
    }
  }
`;

export const FeatureContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.spacing.md};
  margin-top: ${theme.spacing.md};
  margin-bottom: ${theme.spacing.lg};

  @media (max-width: ${breakpoints.mobile}) {
    margin-top: 0;
    margin-bottom: ${theme.spacing.md};
    gap: ${theme.spacing.sm};
    width: 100%;
  }
`;

export const FeatureTitle = styled.h2`
  font-size: ${theme.fonts.sizes.xxl};
  font-weight: ${theme.fonts.weights.semibold};
  font-family: ${theme.fonts.family};
  color: ${theme.colors.text};
  text-align: center;
  line-height: 1.2;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: 20px;
    padding: 0 ${theme.spacing.xs};
  }
`;

export const FeatureDescription = styled.p`
  font-size: ${theme.fonts.sizes.lg};
  font-weight: ${theme.fonts.weights.medium};
  font-family: ${theme.fonts.family};
  color: ${theme.colors.white.darker};
  text-align: center;
  max-width: 873px;
  line-height: 1.4;
  display: flex;
  justify-content: center;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: 13px;
    color: ${theme.colors.white.dark};
    padding: 0 ${theme.spacing.sm};
  }
`;

export const PrimaryButton = styled(PrimaryBtn)`
  padding: 16px 24px;
  background-color: ${theme.colors.green.normal};
  display: flex;
  justify-content: center;
  align-items: center;

  @media (max-width: ${breakpoints.mobile}) {
    width: max-content;
    align-self: center;
    padding: 12px 20px;
    font-size: 14px;
  }
`;

export const FeatureImageWrapper = styled.div`
  width: 100%;
  overflow: hidden;
  margin-top: ${theme.spacing.lg};

  @media (max-width: ${breakpoints.mobile}) {
    margin-top: ${theme.spacing.md};
    display: flex;
    justify-content: center;
    
    img {
      width: 100% !important;
      height: auto !important;
      max-width: 100%;
      object-fit: contain;
    }
  }
`;

export const TestimonialBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.spacing.md};
  max-width: 800px;
  text-align: center;
  padding: ${theme.spacing.xl};

  @media (max-width: ${breakpoints.mobile}) {
    padding: ${theme.spacing.sm};
    text-align: center;
    align-items: center;
  }
`;

export const TestimonialQuote = styled.p`
  font-size: ${theme.fonts.sizes.md};
  color: ${theme.colors.white.darker};
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.regular};
  line-height: 1.8;
  font-style: italic;

  @media (max-width: ${breakpoints.mobile}) {
    font-size: 14px;
    line-height: 1.6;
  }
`;

export const TestimonialAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};

  @media (max-width: ${breakpoints.mobile}) {
    flex-direction: column;
    justify-content: center;
  }
`;

export const AuthorAvatar = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
`;

export const AuthorDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;

  @media (max-width: ${breakpoints.mobile}) {
    text-align: center;
  }
`;

export const AuthorName = styled.p`
  font-size: ${theme.fonts.sizes.md};
  font-weight: ${theme.fonts.weights.semibold};
  font-family: ${theme.fonts.family};
  color: ${theme.colors.text};
`;

export const AuthorRole = styled.p`
  font-size: ${theme.fonts.sizes.sm};
  font-weight: ${theme.fonts.weights.regular};
  font-family: ${theme.fonts.family};
  color: ${theme.colors.white.darker};
`;