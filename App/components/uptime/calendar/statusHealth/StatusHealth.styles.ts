import styled from "styled-components";

export const StatusBar = styled.div<{ color: number }>`
  background: ${({ color }) =>
    color === 1 ? "rgba(0, 224, 158, 0.62)" : "#E63751"};
  width: 38px;
  height: 38px;
  transition: opacity 5s ease-in-out;
  border-radius: 10px;
`;

export const StatusBarsContainer = styled.div`
  display: grid;
  grid-gap: 5px;
  grid-template-columns: repeat(7, 1fr);

  padding: 20px 10px;
  transition: opacity 5s ease-in-out;
`;
