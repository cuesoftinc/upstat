import React from "react";
import {
  LinkCard,
  LogoImage,
  PartnerContainer,
  PartnerLogo,
} from "./Partner.styles";
import aws from "../../assets/aws.png";
import github from "../../assets/github.png";
import microsoft from "../../assets/microsoft.png";
import pay from "../../assets/pay.png";
import dropbox from "../../assets/dropbox.png";
import { Icon } from "@iconify/react";

const Partner = () => {
  return (
    <PartnerContainer>
      <h2>
        Numerous businesses achieve faster and more efficient scalability by
        utilizing the Upstat platform for development.
      </h2>

      <PartnerLogo>
        <LogoImage src={aws} alt="aws" />
        <LogoImage src={dropbox} alt="dropbox" />
        <LogoImage src={github} alt="github" />
        <LogoImage src={pay} alt="pay" />
        <LogoImage src={microsoft} alt="microsoft" />
      </PartnerLogo>
      <LinkCard>
        <p>Read more about our customers</p>
        <span>
          <Icon
            icon="material-symbols-light:arrow-right-alt-rounded"
            fontSize={30}
          />
        </span>
      </LinkCard>
    </PartnerContainer>
  );
};

export default Partner;
