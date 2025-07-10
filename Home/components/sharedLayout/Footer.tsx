"use client";

import React from "react";
import {
  FooterWrap,
  FootWrapper,
  FooterContainer,
  LinkContainer,
  LinkWrapper,
  LogoCards,
  NavLink,
  LineDiv,
  NavWrapper,
  CopyrightWrapper,
  SocialMediaContainer,
  SocialMediaBox,
} from "./Footer.styles";
import { Icon } from "@iconify/react";
import Image from "next/image";
import upstatLogo from "../../assets/upstat_footer_logo.png";

import Link from "next/link";

const Footer = () => {
  return (
    <FooterWrap>
      <FootWrapper>
        <div className="separate__address">
          <FooterContainer>
            <LogoCards>
              <div className="footer__logo">
                <Link href="/">
                  <Image src={upstatLogo} alt="logo" />
                </Link>
              </div>
              <p>
                We help users to track and monitor the performance of a system
                which enhances the user experience.
              </p>
            </LogoCards>

            <LinkWrapper>
              <LinkContainer>
                <h2>Product</h2>
                <NavWrapper>
                  <NavLink href="/">Roadmaps</NavLink>
                  <NavLink href="/" target="">
                    Integration
                  </NavLink>
                  <NavLink href="/" target="">
                    Template
                  </NavLink>
                  <NavLink href="/" target="">
                    Changelog
                  </NavLink>
                </NavWrapper>
              </LinkContainer>

              <LinkContainer>
                <h2>Solution</h2>
                <NavWrapper>
                  <NavLink href="" target="">
                    Customer support
                  </NavLink>

                  <NavLink href="/" target="">
                    Enterprise
                  </NavLink>

                  <NavLink href="/">All use cases</NavLink>
                </NavWrapper>
              </LinkContainer>
              <LinkContainer>
                <h2>Resources</h2>
                <NavWrapper>
                  <NavLink href="/about">Blog</NavLink>
                  <NavLink href="/" target="">
                    Videos
                  </NavLink>
                  <NavLink href="/" target="">
                    Tutorials
                  </NavLink>
                  <NavLink href="/" target="">
                    Customers
                  </NavLink>
                  <NavLink href="/" target="">
                    Partners
                  </NavLink>
                </NavWrapper>
              </LinkContainer>

              <LinkContainer>
                <h2>Contacts</h2>
                <NavWrapper>
                  <NavLink href="tel:+1 302 359 6437">+1 302 359 6437</NavLink>

                  <NavLink href="tel:+234 902 650 9478">
                    +234 902 650 9478
                  </NavLink>

                  <NavLink href="mailto:hello@cuesoft.io">
                    hello@cuesoft.io
                  </NavLink>
                </NavWrapper>
              </LinkContainer>
            </LinkWrapper>
          </FooterContainer>
        </div>
        <LineDiv></LineDiv>
        <CopyrightWrapper>
          <p>
            <span>&copy;</span> Upstat 2024. All rights reserved.
          </p>

          <SocialMediaContainer>
            <SocialMediaBox>
              <Link href="/" target="">
                <Icon icon="iconoir:instagram" />
              </Link>
            </SocialMediaBox>
            <SocialMediaBox>
              <Link href="/" target="">
                <Icon icon="basil:linkedin-outline" />
              </Link>
            </SocialMediaBox>
            <SocialMediaBox>
              <Link href="/" target="">
                <Icon icon="akar-icons:x-fill" />
              </Link>
            </SocialMediaBox>
            <SocialMediaBox>
              <Link href="/" target="">
                <Icon icon="basil:facebook-outline" />
              </Link>
            </SocialMediaBox>
          </SocialMediaContainer>
        </CopyrightWrapper>
      </FootWrapper>
    </FooterWrap>
  );
};

export default Footer;
