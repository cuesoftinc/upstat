import styled from "styled-components";

export const CardContainer = styled.div`
  width: 100%;
  margin: 0 auto;
`;
export const CardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 85%;
  height: 302px;
  color: #fff;
  gap: 11px;
  padding: 30px 48px 30px 47px;
  justify-content: center;
  align-items: center;
  background: linear-gradient(0deg, #29292f 0%, #29292f 100%),
    linear-gradient(0deg, #29292f 0%, #29292f 100%), #29292f;

  h1 {
    font-family: Poppins;
    font-size: 24px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
  }
  p {
    font-family: Poppins;
    font-size: 20px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
  }
`;

export const IconWrapper = styled.div`
  display: flex;
  gap: 133px;
  margin-top: 40px;

  .social_media {
    display: flex;
    gap: 15px;

    span {
      height: 40px;
      width: 40px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 20px;
      border-radius: 50px;
      border: 1px solid #fff;
    }
  }
`;

export const ButtonCard = styled.button`
  display: flex;
  padding: 10px 16px;
  justify-content: center;
  align-items: center;
  gap: 10px;
  border-radius: 5px;
  background: #00a991;
  color: #fff;
  border: none;
  outline: none;
  font-family: Poppins;
  font-size: 20px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
`;
