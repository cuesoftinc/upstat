'use client';

import Image from "next/image";
import dashboard from '../../../assets/images/dashboard-web.png'

import pay from '../../../assets/logos/pay-logo.png'
import github from '../../../assets/logos/github-logo.png'
import aws from '../../../assets/logos/aws-logo.png'
import microsoft from '../../../assets/logos/microsoft-logo.png'
import dropbox from '../../../assets/logos/dropbox-logo.png'
import { TextBtn } from "@/components/ui/button/Button";

import {
  CustomersContainer,
  DashboardWrapper,
  Description,
  LogosScroll,
  LogoItem,
  CTAWrapper,
} from "./customers.styles";

const logos = [
  { src: aws, alt: "AWS", height: 68, width: 86 },
  { src: dropbox, alt: "Dropbox", height: 54, width: 217 },
  { src: github, alt: "Github", height: 54, width: 180 },
  { src: pay, alt: "Pay", height: 68, width: 86 },
  { src: microsoft, alt: "Microsoft", height: 54, width: 243 },
];

export default function Customers() {
  return (
    <CustomersContainer>
      <DashboardWrapper>
        <Image
          src={dashboard}
          alt="Upstat dashboard"
          height={730}
          width={1022}
          style={{ width: "100%", height: "auto" }}
        />
      </DashboardWrapper>

      <Description>
        Numerous businesses achieve faster and more efficient scalability by
        utilizing the Upstat platform for development.
      </Description>

      <LogosScroll>
        {logos.map((logo) => (
          <LogoItem key={logo.alt}>
            <Image
              src={logo.src}
              alt={logo.alt}
              height={logo.height}
              width={logo.width}
              style={{ objectFit: "contain" }}
            />
          </LogoItem>
        ))}
      </LogosScroll>

      <CTAWrapper>
        <TextBtn
          label="Read more about our customers"
          rightIcon="ph:arrow-right-bold"
        />
      </CTAWrapper>
    </CustomersContainer>
  );
}