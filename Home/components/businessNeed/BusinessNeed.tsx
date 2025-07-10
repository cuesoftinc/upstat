import React from "react";
import {
  BusinessContainer,
  BusinessHeader,
  BusinessWrapper,
  BusinessCard,
} from "./BusinessNeed.styles";

const BusinessNeed = () => {
  return (
    <BusinessWrapper>
      <BusinessHeader>
        Works for your <span>Business needs</span>
      </BusinessHeader>

      <BusinessContainer>
        {businessData.map((ev) => (
          <BusinessCard key={ev.id}>
            <h2>{ev.header}</h2>
            <p>{ev.info}</p>
          </BusinessCard>
        ))}
      </BusinessContainer>
    </BusinessWrapper>
  );
};

export default BusinessNeed;

type businessDataType = {
  id: number;
  header: string;
  info: string;
}[];

const businessData: businessDataType = [
  {
    id: 1,
    header: "Scale with your needs",
    info: "Implement Role-Based Access Control (RBAC) with customization options, audit logging, single sign-on, authentication integration, backup/restore, and additional features.",
  },
  {
    id: 2,
    header: "Secure Sign-Ups and Logins",
    info: "Utilize Google and GitHub OAuth, SAML, or OIDC with support for secure authentication and authorization from various popular providers.",
  },
  {
    id: 3,
    header: "Secure self-hosted",
    info: "For complete control, privacy, and security, you have the option to self-host Upstat. This ensures no telemetry, no transmission of private data over the network, and full access to internal data sources and APIs.",
  },
  {
    id: 4,
    header: "Solid Encryption",
    info: "Upstat apps are inherently secure. All connections are TLS-encrypted, and credentials are encrypted with AES-256, ensuring that none of your data is visible to us.",
  },
];
