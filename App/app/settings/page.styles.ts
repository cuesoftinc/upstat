import styled from "styled-components";

interface TabButtonProps {
  active: boolean;
}
const SettingContainer = styled.div`
  background: #16151c;
  color: #fff;
  height: 100%;
  padding: 46px 62px 24px 21px;
`;

const TabButton = styled.button<TabButtonProps>`
  padding: 20px 22px;
  font-weight: 600;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 20px;
  font-weight: 500;
  border-bottom: 2px solid
    ${(props) => (props.active ? "rgba(0, 224, 158, 0.62)" : "none")};
  color: #fff;
  opacity: ${(props) => (props.active ? "" : 0.6)};
`;

const TabHeader = styled.div`
  display: flex;
  gap: 5rem;
  border-bottom: 2px #3c3c3c solid;
  width: 100%;
`;

const ComponentSection = styled.div`
  margin-top: 4rem;
`;
export { SettingContainer, TabButton, TabHeader, ComponentSection };
