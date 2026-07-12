# Security Policy

## Supported Versions

This project is under active development. Security fixes are applied to the
`main` branch. Deployed environments are expected to track `main`.

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Instead, report privately using GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
(the **Security → Report a vulnerability** tab on this repository), or email the
maintainers listed in [CODEOWNERS](CODEOWNERS).

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof-of-concept if possible).
- Affected component (`api/common`, `api/observability`, `web`, `mobile`,
  `deploy`, …).

We aim to acknowledge reports within 3 business days and to provide a
remediation timeline after triage.

## Handling of Secrets

- Never commit credentials, database URIs, API keys, or `.env` files. These are
  covered by [.gitignore](.gitignore) and [.dockerignore](.dockerignore).
- Configuration such as `MONGO_URI`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, SMTP
  credentials, `GROQ_API_KEY`, and the inter-service gRPC auth token must be
  supplied at runtime via environment variables or a secret manager, never
  baked into an image.
