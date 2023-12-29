import Image from "next/image";
import styled from "styled-components";

export const Wrapper = styled.div`
  min-height: 100%;
  padding-bottom: 30px;
`;
export const CodingViewContainer = styled.div`
  width: 940px;
  text-align: center;
  margin-right: auto;
  margin-left: auto;
  padding-top: 20px;
  //border: 2px solid green;
`;

export const CodeSignCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;

  div {
    width: 3px;
    height: 55px;
    background: #00a991;
  }
  span {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    border-radius: 30.655px;
    background: #00a991;
    width: 50px;
    height: 50px;
  }

  p {
    margin-top: 24px;
    color: #00a991;
    font-family: Poppins;
    font-size: 20px;
    font-weight: 600;
  }
`;

export const CodingViewCard = styled.div`
  padding: 0 10px;
  h1 {
    margin-top: 24px;
    color: #fff;
    font-family: Poppins;
    font-size: 36px;
    font-weight: 600;
  }

  p {
    color: #fff;
    text-align: center;
    font-family: Poppins;
    font-size: 20px;
    font-weight: 500;
    padding-top: 20px;
  }
`;

// export const CodeButton = styled.button`
//   background-color: #00a991;
//   margin-top: 41px;
//   display: flex;
//   padding: 16px 24px;
//   justify-content: center;
//   align-items: center;
//   gap: 10px;
//   color: #fff;
//   margin-right: auto;
//   margin-left: auto;
//   font-size: 20px;
//   font-weight: 600;
//   border: none;
//   outline: none;
//   border-radius: 5px;
//   cursor: pointer;
// `;

export const ImageContainer = styled.div`
  margin-right: auto;
  margin-left: auto;
  width: 940px;
  display: flex;
  justify-content: center;
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

export const ImageBox = styled(Image)`
  margin-top: 5rem;
`;
