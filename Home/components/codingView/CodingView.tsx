import React from "react";
import {
  CodingViewContainer,
  CodingViewCard,
  CodeSignCard,
  ImageBox,
  ImageContainer,
  InfoWrapper,
  Wrapper,
  Card,
} from "./CodingView.styles";
import { Icon } from "@iconify/react";
import Image from "next/image";
import upstatDesktop from "../../assets/upstat_desktop_view.png";
import ibukunDairo from "../../assets/ibukun-dairo.jpg";
import { Button } from "../button/Button";
const CodingView = () => {
  return (
    <Wrapper>
      <CodingViewContainer>
        <CodeSignCard>
          <div></div>
          <span>
            <Icon icon="mdi:code" />
          </span>
          <p>Code</p>
        </CodeSignCard>
        <CodingViewCard>
          <h1>Personalize and develop through coding.</h1>
          <p>
            {" "}
            Compose in-line JavaScript or employ reusable code blocks to expand
            your app's functionality, tailor your UI, or implement conditional
            logic.
          </p>
        </CodingViewCard>

        {/* <CodeButton>
          Write Javascript in Upstat <Icon icon="formkit:arrowright" />
        </CodeButton> */}
        <Button text="Write Javascript in Upstat" />
      </CodingViewContainer>
      <ImageContainer>
        <ImageBox src={upstatDesktop} alt="upstat" />
      </ImageContainer>
      <InfoWrapper>
        <p className="info">
          “After experimenting with various low-code solutions, Upstat emerged
          as the clear winner for our specific use case. The remarkable speed at
          which you can assemble an internal tool is unparalleled. We seamlessly
          integrated it with our data warehouse, Microsoft Teams, and our
          logging, monitoring, and metrics infrastructure."
        </p>

        <Card>
          <Image
            src={ibukunDairo}
            alt="CEO"
            height={50}
            width={50}
            className="image"
          />
          <div className="card_info">
            <h3>Ibukun Dairo</h3>
            <p>CEO, Cuesoft</p>
          </div>
        </Card>
      </InfoWrapper>
    </Wrapper>
  );
};

export default CodingView;
