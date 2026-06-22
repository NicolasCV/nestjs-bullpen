# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems. Email **nicolas@prestavale.mx** with details and, if possible, a reproduction. You'll get an acknowledgement within a few days, and a fix or mitigation will be coordinated before any public disclosure.

## Supported versions

Bullpen is pre-1.0, so fixes land on the latest published `0.x` release. Once 1.0 ships, this section will list the supported version range.

## A note on exposure

The dashboard can read and mutate your queues. Always put it behind authentication in any shared or production environment (see [docs/authentication.md](./docs/authentication.md)), and consider `readOnly` mode where mutation isn't needed.
