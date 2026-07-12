import styled from "styled-components";

export const BusinessWrapper = styled.div`
  padding: 50px 0;
`;

export const BusinessHeader = styled.h1`
  color: #fff;
  font-family: Poppins;
  font-size: 48px;
  font-weight: 600;
  text-align: center;

  span {
    color: #00a991;
  }
`;

export const BusinessContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 90%;
  grid-row-gap: 41px;
  grid-column-gap: 41px;
  margin-top: 45px;
  margin-left: auto;
  margin-right: auto;
`;

export const BusinessCard = styled.div`
  width: 590px;
  height: 210px;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  padding: 45px 91px;
  gap: 16px;
  background: rgba(217, 217, 217, 0.1);

  h2 {
    color: #fff;
    text-align: center;
    font-family: Poppins;
    font-size: 24px;
    font-weight: 600;
  }

  p {
    color: #fff;
    font-family: Poppins;
    font-size: 16px;
    text-align: center;
    font-weight: 400;
  }
`;
