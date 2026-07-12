import styled from "styled-components";

export const HeroWrapper = styled.div`
  height: min-height;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding-top: 60px;
  padding-bottom: 80px;

  h1 {
    width: 80%;
    color: #fff;
    font-family: Poppins;
    font-size: 72px;
    font-style: normal;
    font-weight: 600;
    text-align: center;
  }
  h1 > span {
    color: #00a991;
  }

  p {
    text-align: center;
    font-family: Poppins;
    font-size: 20px;
    font-style: normal;
    font-weight: 400;
    width: 60%;
    margin-top: 16px;
  }

  div {
    display: flex;
    gap: 32px;
    margin-top: 38px;

    .host {
      display: flex;
      padding: 13px 20px;
      justify-content: center;
      align-items: center;
      gap: 10px;
      border: 1px solid #00a991;
      color: #00a991;
      background: transparent;
      font-family: Poppins;
      font-size: 20px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;
      border-radius: 5px;
      cursor: pointer;
    }
    .cloud {
      display: flex;
      padding: 13px 20px;
      justify-content: center;
      align-items: center;
      gap: 10px;
      border: none;
      outline: none;
      color: fff;
      background: #00a991;
      font-family: Poppins;
      font-size: 20px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;
      border-radius: 5px;
      cursor: pointer;
    }
  }
`;
