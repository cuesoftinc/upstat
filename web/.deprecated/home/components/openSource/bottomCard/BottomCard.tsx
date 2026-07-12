import React from "react";
import {
  ButtonCard,
  CardWrapper,
  IconWrapper,
  CardContainer,
} from "./Bottom.styles";

type OpenSourceDataType = {
  header: string;
  info: string;
  socialMedia: boolean;
  buttonText: string;
};
import { Icon } from "@iconify/react";

const BottomSection = ({
  header,
  info,
  socialMedia,
  buttonText,
}: OpenSourceDataType) => {
  return (
    <CardWrapper>
      <h1>{header}</h1>
      <p>{info}</p>
      <IconWrapper>
        {socialMedia && (
          <div className="social_media">
            <span>
              <Icon icon="prime:instagram" />
            </span>{" "}
            <span>
              <Icon icon="basil:linkedin-outline" />
            </span>{" "}
            <span>
              <Icon icon="pajamas:twitter" />
            </span>{" "}
            <span>
              <Icon icon="basil:facebook-outline" />
            </span>
          </div>
        )}
        <ButtonCard>
          {buttonText}{" "}
          <span>
            <Icon icon="formkit:arrowright" />
          </span>
        </ButtonCard>
      </IconWrapper>
    </CardWrapper>
  );
};

export default BottomSection;
