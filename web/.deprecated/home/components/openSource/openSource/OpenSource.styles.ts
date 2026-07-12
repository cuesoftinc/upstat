import Image from "next/image";
import styled from "styled-components";

export const OpenSourceWrapper = styled.div`
  padding: 50px 0;
  width: 100%;
`;

export const OpenSourceHeader = styled.h1`
  color: #fff;
  font-family: Poppins;
  font-size: 48px;
  font-weight: 600;
  text-align: center;
  margin: 0 auto;
  width: 60%;

  span {
    color: #00a991;
  }
`;

export const CardContainer = styled.div`
  margin-top: 87px;
`;

export const OpenSourceCard = styled.div`
  width: 90%;
  position: relative;
  background: #00a991;
  margin: 0 auto;
  padding: 57px 413px 124px 44px;
  border-radius: 10px;
  z-index: 999;
  overflow: hidden;

  .card_info {
    color: #fff;
    display: flex;
    flex-direction: column;
    gap: 28px;

    h1 {
      font-family: Poppins;
      font-size: 48px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;
    }

    p {
      font-family: Poppins;
      font-size: 20px;
      font-style: normal;
      font-weight: 500;
      line-height: normal;
    }
  }
`;

export const CardImage = styled(Image)`
  position: absolute;
  right: -55px;
  top: -35px;
  z-index: 0;
  overflow: hidden;
`;

export const BottomSectionWrapper = styled.div`
  display: flex;
  gap: 43px;
  margin-top: 80px;
  margin-left: auto;
  margin-right: auto;
  width: 90%;
`;
