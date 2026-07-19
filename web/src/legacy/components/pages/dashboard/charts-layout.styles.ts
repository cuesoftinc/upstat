import styled from "styled-components";

export const ChartsRow = styled.div`
  display: flex;
  gap: ${(props) => props.theme.spacing.xl};
  align-items: flex-start;

  @media (max-width: 1024px) {
    flex-direction: column;
  }
`;

export const SecondaryRow = styled.div`
  display: flex;
  gap: ${(props) => props.theme.spacing.xl};
  margin-top: ${(props) => props.theme.spacing.xl};

  @media (max-width: 1024px) {
    flex-direction: column;
  }
`;