import styled from "styled-components";
import Image from "next/image";

export const PartnerContainer = styled.div`
  margin-top: 86px;

  h2 {
    color: #fff;
    text-align: center;
    font-family: Poppins;
    font-size: 20px;
    font-style: normal;
    font-weight: 500;
  }
`;

export const PartnerLogo = styled.div`
  display: flex;
  gap: 80px;
  border-radius: 5px;
  margin: 40px 72px;
  height: 79px;
  padding: 0 32px;
  width: 80%;
`;

export const LogoImage = styled(Image)``;

export const LinkCard = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  justify-items: center;
  cursor: pointer;

  p {
    color: #fff;
    font-family: Poppins;
    font-size: 20px;
    font-style: normal;
    font-weight: 500;
  }
`;
