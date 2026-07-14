"use client";
import Image from "next/image";
import { Icon } from "@iconify/react";
import community from '../../../assets/images/globe.png'
import {
  CommunityContainer,
  CommunityHeader,
  CommunityTitle,
  CommunityTitleGreen,
  FeaturedBanner,
  BannerContent,
  BannerTitle,
  BannerDescription,
  BannerImageWrapper,
  BottomGrid,
  InfoCard,
  CardTitle,
  CardDescription,
  CardFooterRow,
  SocialIconGroup,
  SocialIconLink,
  ActionButton,
} from "./community.styles";

export default function Community() {
  return (
    <CommunityContainer>

      <CommunityHeader>
      
        <CommunityTitle>
          Open-source, Transparent and
          <CommunityTitleGreen>&nbsp;community-driven</CommunityTitleGreen>
        </CommunityTitle>

      </CommunityHeader>

      <FeaturedBanner>

        <BannerContent>
          <BannerTitle>Open-source</BannerTitle>
          <BannerDescription>
            Maintain complete control over your applications indefinitely. Eliminate concerns
            about vendor lock-in with our open-source platform.
            <br />
            <br />
            UPstat is licensed under Apache License 2.0.
          </BannerDescription>
        </BannerContent>

        <BannerImageWrapper>
          <Image
            src={community}
            alt="Globe illustration"
            width={533}
            height={533}
            priority
            style={{ objectFit: "fill" }}
          />
        </BannerImageWrapper>
      </FeaturedBanner>

      <BottomGrid>
        <InfoCard>
          <CardTitle>Our vibrant community of developers</CardTitle>
          <CardDescription>
            Top-notch support and a robust partner ecosystem guarantee that you receive all the
            assistance you require.
          </CardDescription>
          <CardFooterRow>
            <SocialIconGroup>
              <SocialIconLink href="#" aria-label="Discord">
                <Icon icon="ph:discord-logo" width="20" height="20" />
              </SocialIconLink>
              <SocialIconLink href="#" aria-label="GitHub">
                <Icon icon="ph:github-logo" width="20" height="20" />
              </SocialIconLink>
              <SocialIconLink href="#" aria-label="X / Twitter">
                <Icon icon="ph:x-logo" width="18" height="18" />
              </SocialIconLink>
              <SocialIconLink href="#" aria-label="LinkedIn">
                <Icon icon="ph:linkedin-logo" width="20" height="20" />
              </SocialIconLink>
            </SocialIconGroup>
            <ActionButton href="#">
              Community <Icon icon="ph:arrow-right-bold" width="14" height="14" />
            </ActionButton>
          </CardFooterRow>
        </InfoCard>

        <InfoCard>
          <CardTitle>Expanding partner network.</CardTitle>
          <CardDescription>
            To assist you in creating superior applications more quickly.
          </CardDescription>
          <CardFooterRow style={{ justifyContent: "flex-start" }}>
            <ActionButton href="#">
              Upstat Partner Program <Icon icon="ph:arrow-right-bold" width="14" height="14" />
            </ActionButton>
          </CardFooterRow>
        </InfoCard>
      </BottomGrid>
    </CommunityContainer>
  );
}
