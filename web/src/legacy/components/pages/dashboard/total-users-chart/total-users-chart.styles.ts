import styled from "styled-components";

export const Card = styled.div`
flex: 1 1 65%;
  background: ${(props) => props.theme.colors.surface.card};
  border: 1px solid ${(props) => props.theme.colors.border.subtle};
  border-radius: ${(props) => props.theme.borderRadius.lg};
  padding: ${(props) => props.theme.spacing.xl};
  min-width: 0;

  @media (max-width: 1024px) {
    flex: 1 1 100%;
  }
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${(props) => props.theme.spacing.lg};
`;

export const Title = styled.h3`
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-weight: ${(props) => props.theme.typography.weights.semibold};
  font-size: ${(props) => props.theme.typography.sizes.lg};
  color: ${(props) => props.theme.colors.text.primary};
  margin: 0;
`;

export const Legend = styled.div`
  display: flex;
  align-items: center;
  gap: ${(props) => props.theme.spacing.sm};
  font-size: ${(props) => props.theme.typography.sizes.sm};
  color: ${(props) => props.theme.colors.text.secondary};
`;

export const ChartWrapper = styled.div`
  width: 100%;
  height: 320px;

  @media (max-width: 480px) {
    height: 240px;
  }
`;

export const TooltipBadge = styled.div`
  background: ${(props) => props.theme.colors.brand};
  color: ${(props) => props.theme.colors.text.primary};
  font-size: ${(props) => props.theme.typography.sizes.xs};
  font-weight: ${(props) => props.theme.typography.weights.medium};
  padding: 4px 10px;
  border-radius: ${(props) => props.theme.borderRadius.full};
  white-space: nowrap;
`;