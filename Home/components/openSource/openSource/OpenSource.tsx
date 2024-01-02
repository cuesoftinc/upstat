import React from "react";
import {
  CardContainer,
  CardImage,
  OpenSourceCard,
  BottomSectionWrapper,
  OpenSourceHeader,
  OpenSourceWrapper,
} from "./OpenSource.styles";
import globe from "../../../assets/globe.png";
import BottomSection from "../bottomCard/BottomCard";
const OpenSource = () => {
  return (
    <OpenSourceWrapper>
      <OpenSourceHeader>
        Open-source, Transparent and <span>community-driven</span>
      </OpenSourceHeader>

      <CardContainer>
        <OpenSourceCard>
          <div className="card_info">
            <h1>Open-source</h1>
            <p>
              Maintain complete control over your applications indefinitely.
              Eliminate concerns about vendor lock-in with our open-source
              platform.
            </p>
            <p>UPstat is licensed under Apache License 2.0.</p>
          </div>

          <CardImage
            src={globe}
            alt="globe"
            height={400}
            width={400}
          ></CardImage>
        </OpenSourceCard>
      </CardContainer>

      <BottomSectionWrapper>
        <BottomSection
          header="Our vibrant community of developers"
          info="Top-notch support and a robust partner ecosystem guarantee that you receive all the assistance you require"
          socialMedia={true}
          buttonText="Community"
        />
        <BottomSection
          header="Expanding partner network."
          info="To assist you in creating superior applications more quickly."
          socialMedia={false}
          buttonText="Upstat Partner Program"
        />
      </BottomSectionWrapper>
    </OpenSourceWrapper>
  );
};

export default OpenSource;
