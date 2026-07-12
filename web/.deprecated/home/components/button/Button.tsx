import React from "react";
import styled from "styled-components";
import { Icon } from "@iconify/react";

type ButtonProps = {
  text: string;
};
export const Button = ({ text }: ButtonProps) => {
  return (
    <ButtonContainer>
      {text} <Icon icon="formkit:arrowright" />
    </ButtonContainer>
  );
};

const ButtonContainer = styled.button`
  background-color: #00a991;
  margin-top: 41px;
  display: flex;
  padding: 16px 24px;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: #fff;
  margin-right: auto;
  margin-left: auto;
  font-size: 20px;
  font-weight: 600;
  border: none;
  outline: none;
  border-radius: 5px;
  cursor: pointer;
`;
