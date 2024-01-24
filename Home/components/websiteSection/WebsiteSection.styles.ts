import styled from "styled-components";
import Image from "next/image";

export const WebsiteContainer = styled.div`
  width: 90%;
  margin: 0 72px;
  height: 400px;
  border-radius: 5px;
  position: relative;
  background: #00a991;
`;

export const WebsiteWrapper = styled.div`
  width: 100%;
  margin: 89px 0;
`;

export const BtnGroup = styled.div`
  display: flex;
  gap: 32px;

  .web-host {
    display: flex;
    padding: 13px 20px;
    justify-content: center;
    align-items: center;
    gap: 10px;
    border: 1px solid #fff;
    color: #fff;
    background: transparent;
    font-family: Poppins;
    font-size: 20px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    border-radius: 5px;
    cursor: pointer;
  }
  .web-cloud {
    display: flex;
    padding: 13px 20px;
    justify-content: center;
    align-items: center;
    gap: 10px;
    border: none;
    outline: none;
    background: #fff;
    color: #00a991;
    font-family: Poppins;
    font-size: 20px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    border-radius: 5px;
    cursor: pointer;
  }
`;

export const WebsiteCard = styled.div`
  display: flex;
  gap: 23px;
  flex-direction: column;
  width: 60%;
  padding: 55px 49px;

  h1 {
    font-family: Poppins;
    font-size: 48px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
    color: #fff;
  }
  p {
    font-family: Poppins;
    font-size: 20px;
    font-style: normal;
    font-weight: 500;
    color: #fff;
  }
`;

export const WebImage = styled(Image)`
  position: absolute;
  right: 0;
  bottom: 0;
`;
