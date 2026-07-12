import styled from "styled-components";
import Image from "next/image";

export const HeaderWrapper = styled.nav`
  width: 100%;
  display: flex;
  justify-content: space-between;
  padding: 32px 72px;
`;

export const LogoImage = styled(Image)``;

export const ListContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;

  .github {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #00a991;
    font-size: 16px;
    p {
      font-family: Poppins;

      font-style: normal;
      font-weight: 500;
      color: #00a991;
    }
  }
`;

export const LoginWrapper = styled.div`
  display: flex;
  gap: 24px;

  .login {
    display: flex;
    padding: 8px 16px;
    justify-content: center;
    align-items: center;
    gap: 10px;
    border: 1px solid #00a991;
    color: #00a991;
    background: transparent;
    font-family: Poppins;
    font-size: 16px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
    border-radius: 5px;
    cursor: pointer;
  }
  .signup {
    display: flex;
    padding: 8px 16px;
    justify-content: center;
    align-items: center;
    gap: 10px;
    border: none;
    outline: none;
    color: fff;
    background: #00a991;
    font-family: Poppins;
    font-size: 16px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
    border-radius: 5px;
    cursor: pointer;
  }
`;

export const List = styled.div`
  display: flex;
  align-items: center;
  justify-items: center;
  gap: 2px;
  cursor: pointer;
  color: #fff;
  font-family: Poppins;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
`;
