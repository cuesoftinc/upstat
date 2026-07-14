"use client";


import {
  BusinessContainer,
  BusinessHeader,
  BusinessTitle,
  BusinessTitleGreen,
  GridContainer,
  Card,
  CardTitle,
  CardDescription,
} from "./business-needs.styles";

const needs = [
  {
    title: "Scale with your needs",
    description:
      "Implement Role-Based Access Control (RBAC) with customization options, audit logging, single sign-on, authentication integration, backup/restore, and additional features.",
  },
  {
    title: "Secure Sign-Ups and Logins",
    description:
      "Utilize Google and GitHub OAuth, SAML, or OIDC with support for secure authentication and authorization from various popular providers.",
  },
  {
    title: "Secure self-hosted",
    description:
      "For complete control, privacy, and security, you have the option to self-host Upstat. This ensures no telemetry, no transmission of private data over the network, and full access to internal data sources and APIs.",
  },
  {
    title: "Solid Encryption",
    description:
      "Upstat apps are inherently secure. All connections are TLS-encrypted, and credentials are encrypted with AES-256, ensuring that none of your data is visible to us.",
  },
];

export default function BusinessNeeds() {
  return (
    <BusinessContainer>
      <BusinessHeader>
        <BusinessTitle>
          Works for your <BusinessTitleGreen>&nbsp;Business needs</BusinessTitleGreen>
        </BusinessTitle>
      </BusinessHeader>

      <GridContainer>
        {needs.map((need, index) => (
          <Card key={index}>
            <CardTitle>{need.title}</CardTitle>
            <CardDescription>{need.description}</CardDescription>
          </Card>
        ))}
      </GridContainer>
    </BusinessContainer>
  );
}
