import Link from "next/link";
import { styled } from "styled-components";

export const FooterWrap = styled.footer`
  position: relative;
  background-color: #00a991;
  margin-top: 60px;
  width: 100% !important;
  z-index: 10;
`;

export const FootWrapper = styled.div`
  padding: 0 60px 50px 60px;
  width: 100%;
  .address {
    width: 50%;
    margin: -30px 0 0 auto;
    display: flex;
    gap: 10px;
  }
  .address > p > span {
    display: block;
  }
  .address > p > span:last-child {
    margin-top: 15px;
    display: block;
  }
`;

export const FooterContainer = styled.div`
  display: flex;
  justify-content: space-between;
  padding-top: 40px;
`;

export const LogoCards = styled.div`
  width: 35%;

  .footer__logo {
    text-align: center;
    width: fit-content;
    line-height: 0.5cm;
  }

  

  > p {
    color: #ffffff;
    font-family: Poppins;
    font-size: 16px;
    font-style: normal;
    font-weight: 500;
    line-height: normal;
    margin-top:5px;
  }

  

  .footer__btn {
    background-color: #fcd54d;
    color: #000;
    margin-inline: 0;
    border: none;
    font-weight: 600;
  }
  .footer__btn > a {
    color: #000;
    text-decoration: none;
    padding: 10px 0 10px 20px;
  }
  .footer__btn > span {
    padding-right: 20px;
  }
  
  }
`;

export const LinkWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  width: 50%;
`;

export const LinkContainer = styled.div`
  h2 {
    font-family: Poppins;
    color: #ffffff;
    font-size: 24px;
    font-style: normal;
    font-weight: 700;
  }
`;

export const NavWrapper = styled.div`
  display: flex;
  padding-top: 18px;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
`;

export const NavLink = styled(Link)`
  text-decoration: none;
  font-size: 16px;
  font-family: Poppins;
  font-style: normal;
  font-weight: 500;
  line-height: normal;

  &:hover {
    color: #8c8c8c;
  }
`;

export const LineDiv = styled.div`
  height: 2px;
  margin-top: 40px;
  background: #ffffff;
`;

export const CopyrightWrapper = styled.div`
  display: flex;
  margin-top: 20px;
  justify-content: space-between;
  align-items: center;
  p {
    font-size: 20px;
    font-style: normal;
    font-weight: 700;
    line-height: normal;
    color: #fff;
  }
`;

export const SocialMediaContainer = styled.div`
  display: flex;
  gap: 10px;
`;

export const SocialMediaBox = styled.span`
  cursor: pointer;
  border: 2px solid #fff;
  border-radius: 50%;
  height: 40px;
  width: 40px;
  color: #fff;
  size: 25px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #b5b5b5;
    border: 3px solid #b5b5b5;
  }

  > a {
    color: #fff;
    text-decoration: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .social__media__icon {
    font-size: 25px;
  }
`;
