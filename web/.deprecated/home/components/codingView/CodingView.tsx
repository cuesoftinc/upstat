import React from "react";
import {
  CodingViewContainer,
  CodingViewCard,
  CodeSignCard,
  ImageBox,
  ImageContainer,
  Wrapper,
} from "./CodingView.styles";

import { Button } from "../button/Button";

const CodingView = ({
  icon,
  iconText,
  header,
  info,
  image,
  btnText,
  imageAlt,
}: webDataType) => {
  return (
    <Wrapper>
      <CodingViewContainer>
        <CodeSignCard>
          <div></div>
          <span>{icon}</span>
          <p>{iconText}</p>
        </CodeSignCard>
        <CodingViewCard>
          <h1>{header}</h1>
          <p>{info}</p>
        </CodingViewCard>

        <Button text={btnText} />
      </CodingViewContainer>
      <ImageContainer>
        <ImageBox src={image} alt={imageAlt} />
      </ImageContainer>
    </Wrapper>
  );
};

export default CodingView;

type webDataType = {
  icon: any;
  iconText: string;
  header: string;
  info: string;
  btnText: string;
  image: any;
  imageAlt: string;
};
