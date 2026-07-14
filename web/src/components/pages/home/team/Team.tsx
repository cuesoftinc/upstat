"use client";

import Image from "next/image";
import asideImg from '../../../assets/images/aside-img.png'
import {
  AsideContainer,
  AsideInner,
  AsideContent,
  AsideTitle,
  AsideSubtitle,
  AsideActions,
  AsideImageWrapper,
  AsidePrimaryBtn,
  AsideSecondaryBtn,
} from "./team.styles";

export default function Team () {
  return (
    <AsideContainer>

      <AsideInner>

        <AsideContent>

          <AsideTitle>
            Give your teams the tools they need to track faster
          </AsideTitle>

          <AsideSubtitle>
            Upstat simplifies internal tool development for businesses. It
            provides real time monitoring and analysis of website, serve and API
            performance to ensure optimal uptime and user experience for
            businesses.
          </AsideSubtitle>

          <AsideActions>
            <AsidePrimaryBtn label='Try Cloud'></AsidePrimaryBtn>
            <AsideSecondaryBtn label='Self-host'></AsideSecondaryBtn>
          </AsideActions>

        </AsideContent>

        <AsideImageWrapper>
          <Image
            src={asideImg}
            alt="Upstat dashboard preview"
            width={415}
            height={321}
            style={{ display: "block"}}
          />
        </AsideImageWrapper>

      </AsideInner>
    </AsideContainer>
  );
}