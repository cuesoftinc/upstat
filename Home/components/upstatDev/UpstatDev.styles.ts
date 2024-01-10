import styled from "styled-components";

export const DevWrapper = styled.div``;

export const DevContainer = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 26px;

  h1 {
    font-family: Poppins;
    font-size: 48px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
  }

  h1 > span {
    color: #00a991;
  }

  p {
    font-family: Poppins;
    font-size: 24px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
  }
`;

export const InfoWrapper = styled.div`
  width: 1280px;
  margin-right: auto;
  margin-left: auto;
  margin-top: 171px;
  .info {
    color: #fff;
    text-align: center;
    font-family: Poppins;
    font-size: 20px;
    font-weight: 500;
  }
`;

export const Card = styled.div`
  display: flex;
  justify-content: center;
  justify-items: center;
  align-items: center;
  gap: 10px;
  margin-top: 30px;
  .image {
    border-radius: 50px;
  }

  .card_info h3 {
    font-family: Poppins;
    font-size: 16px;
    color: #fff;
    font-weight: 600;
  }
  .card_info p {
    color: rgba(255, 255, 255, 0.5);
    font-family: Poppins;
    font-size: 16px;
    font-weight: 600;
    margin-top: 5px;
  }
`;
