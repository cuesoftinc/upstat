import styled from "styled-components";

interface TabButtonProps {
  active: boolean;
}
export const ToolContainer = styled.div`
  height: 100%;
`;

export const TabButton = styled.button<TabButtonProps>`
  margin: 16px 0;
  padding: 16px 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  border: none;
  outline: none;
  font-family: Poppins;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  cursor: pointer;
  border-radius: 5px;

  background: ${(props) => (props.active ? "#000" : "none")};

  color: #fff;
`;

export const TabHeader = styled.div`
  display: flex;
  gap: 30px;
  border-radius: 5px;
  background: rgba(217, 217, 217, 0.1);
  margin: 0 72px;
  height: 79px;
  padding: 0 32px;
  width: 90%;
`;

export const ComponentSection = styled.div`
  margin-top: 4rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;
