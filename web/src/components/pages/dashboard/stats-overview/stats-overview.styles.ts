import styled from "styled-components";

export const Row = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
  margin: ${(props) => props.theme.spacing.xl} 0;
  @media (max-width: 480px) {
    gap: 16px;
  }
`;

export const Card = styled.div`
display: flex;
flex-direction: column;
gap: ${(props) => props.theme.spacing.md};
padding: ${(props) => props.theme.spacing.xl} ${(props) => props.theme.spacing.lg};
height: 110px;
justify-content: space-between;
flex: 1 1 201px;
border-radius: 10px;
background: ${(props) => props.theme.colors.surface.card};

  @media (max-width: 480px) {
    flex: 1 1 calc(50% - 8px);
    min-width: 0;
    height: 100px;
    padding: ${(props) => props.theme.spacing.sm} ${(props) => props.theme.spacing.md};
  }
`;


export const Label = styled.span`
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-weight: ${(props) => props.theme.typography.weights.medium};
  font-size: ${(props) => props.theme.typography.sizes.base}; 
  line-height: 100%;
  color: ${(props) => props.theme.colors.text.primary};

  @media (max-width: 480px) {
    font-size: ${(props) => props.theme.typography.sizes.sm};
  }
`;

export const ValueRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${(props) => props.theme.spacing.sm};
`;

export const Value = styled.span`
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-weight: ${(props) => props.theme.typography.weights.semibold};
  font-size: ${(props) => props.theme.typography.sizes.xl};
  line-height: 100%;
  color: ${(props) => props.theme.colors.text.primary};

  @media (max-width: 480px) {
    font-size: ${(props) => props.theme.typography.sizes.lg};
  }
`;

export const Change = styled.span<{ $positive: boolean }>`
  display: flex;
  align-items: center;
  gap: 2px;
  font-family: ${(props) => props.theme.typography.fontFamily};
  font-weight: ${(props) => props.theme.typography.weights.medium};
  font-size: ${(props) => props.theme.typography.sizes.base}; 
  line-height: 100%;
  color: ${({ $positive, theme }) =>
    $positive ? theme.colors.brand : theme.colors.error};

  @media (max-width: 480px) {
    font-size: ${(props) => props.theme.typography.sizes.sm};
  }
`;

export const SkeletonBlock = styled.div<{ $height: string; $width?: string }>`
  height: ${({ $height }) => $height};
  width: ${({ $width }) => $width ?? "100%"};
  border-radius: ${(props) => props.theme.borderRadius.sm};
  background: ${(props) => props.theme.colors.border.subtle};
  opacity: 0.4;
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.7; }
  }
`;