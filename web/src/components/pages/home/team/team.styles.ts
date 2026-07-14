import { styled } from "styled-components";
import { theme } from "@/components/libs/theme";
import { PrimaryBtn, SecondaryBtn } from "@/components/ui/button/Button";

const breakpoints = {
  mobile: "768px",
  tablet: "1024px",
};

export const AsideContainer = styled.section`
  width: 100%;
  margin: auto;
  display: flex;
  justify-content: center;
  background: ${theme.colors.background};
  padding: ${theme.spacing.xxl} ${theme.spacing.xl};
  overflow: hidden;

  @media (max-width: ${breakpoints.mobile}) {
    padding: ${theme.spacing.xl} 16px;
  }

  @media (max-width: ${breakpoints.tablet}) {
  padding: ${theme.spacing.xl} ${theme.spacing.md};
}
`;

export const AsideInner = styled.div`
  width: 100%;
  max-width: 1295px;
  height: 448px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: ${theme.colors.primary};
  border-radius: ${theme.borderRadius.md};
  overflow: hidden;
  position: relative;

  @media (max-width: ${breakpoints.mobile}) {
    flex-direction: column;
    height: auto;
    min-height: 714px;
    max-width: 343px;
    border-radius: 5px;
    align-items: flex-start;
    gap: 1px;
  }

  @media (max-width: ${breakpoints.tablet}) {
  height: auto;
  min-height: 400px;
}
`;

export const AsideContent = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${theme.spacing.md};
  flex: 1;
  padding: 55px 49px;

  @media (max-width: ${breakpoints.mobile}) {
    padding: 24px 16px;
    max-width: 100%;
    gap: ${theme.spacing.xs};
  }

  @media (max-width: ${breakpoints.tablet}) {
  padding: 32px 24px;
}
`;

export const AsideTitle = styled.h2`
 width: 785px;
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.semibold};
  font-size: 48px;
  line-height: 1.4;
  letter-spacing: 0%;
color: ${theme.colors.text};
  @media (max-width: ${breakpoints.mobile}) {
    width: 100%;
    font-size: 24px;
    line-height: 1.4;
  }

  @media (max-width: ${breakpoints.tablet}) {
  width: 100%;
  font-size: 32px;
}
`;

export const AsideSubtitle = styled.p`
  width: 789px;
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.regular};
  font-size: ${theme.fonts.sizes.lg};
  line-height: 1.4;
  color: ${theme.colors.text};

  @media (max-width: ${breakpoints.mobile}) {
    width: 100%;
    font-size: 14px;
    text-align: justify;
  }

  @media (max-width: ${breakpoints.tablet}) {
  width: 100%;
  font-size: ${theme.fonts.sizes.md};
}
`;

export const AsideActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
  margin-top: ${theme.spacing.sm};
`;

export const AsidePrimaryBtn = styled(PrimaryBtn)`
  border-radius: 5px;
  padding: 14px 20px;
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.medium};
  font-size: ${theme.fonts.sizes.md};
  cursor: pointer;
  background: #ffffff;
  color: ${theme.colors.primary};
  border: none;
  transition: opacity 0.2s ease;
  white-space: nowrap;

  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

export const AsideSecondaryBtn= styled(SecondaryBtn)`
  border-radius: 5px;
  padding: 14px 20px;
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.medium};
  font-size: ${theme.fonts.sizes.md};
  cursor: pointer;
  color: ${theme.colors.text};
  border:1px solid ${theme.colors.text};
  transition: opacity 0.2s ease;
  white-space: nowrap;
  background: transparent;

  &:hover { opacity: 0.85; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;


export const AsideImageWrapper = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  align-self: stretch;
  flex-shrink: 0;
  padding-top: 127px;
  padding-right: 1px;
  margin: 0;

  img {
    display: block;
    height: 100%;
    width: auto;
    object-fit: cover;
    object-position: top left;
    border-radius: 0;
  }

  @media (max-width: ${breakpoints.mobile}) {
    width: 100%;
    justify-content: center;

    img {
      width: 284px;
      height: 321px;
      margin-left: 61px;
      position: relative;
      bottom: 0;
      right: 0;
    }
  }

  @media (max-width: ${breakpoints.tablet}) {
  padding-top: 60px;

  img {
    width: 280px;
    height: auto;
  }
}
`;