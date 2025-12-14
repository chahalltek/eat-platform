# Environment Modes

This document summarizes how security controls are applied across EAT environments today and how they will change after the Azure migration. It is intended as a quick reference for engineers, SRE, and security reviewers.

## Mode comparison
| Mode | Purpose | Identity & RBAC | Network & Secrets | Observability & Logging |
| --- | --- | --- | --- | --- |
| **Local** | Developer workstations and ephemeral previews | Local auth with scoped tokens; no production data | Uses `.env` or local secret injectors; connects to mock services when available | Local logging only; opt-in debug traces |
| **Dev** | Integration of new features, shared test data | Project RBAC enforced; elevated roles limited to service owners | Secrets stored in per-environment store; ingress restricted to VPN or SSO | Centralized logs with short retention; alerting for critical regressions |
| **Staging** | Pre-production validation with near-prod parity | Same RBAC model as prod; change approvals required for elevated privileges | Secrets separated from prod; limited production integrations allowed for E2E validation | Full observability stack enabled; alerting mirrors prod thresholds |
| **Production** | Customer-facing workloads | Strict RBAC with least-privilege roles and audited admin actions | Secrets isolated per service; ingress via managed gateways; feature flags gate risky changes | Long-term log retention and audit trails; mandatory deployment traces |

## Additional guardrails
- **Feature flags:** All high-risk features must be behind flags; flags are promoted from dev → staging → production after validation.
- **AI gateway:** All model access and prompt flows traverse the AI gateway with logging and quotas to prevent abuse and data leakage.
- **Approvals:** Production deployments and schema changes require approver sign-off; emergency changes are documented post-factum.

## Changes after Azure migration
- **Identity:** All modes will rely on Entra ID; service principals will replace legacy deploy tokens.
- **Secrets:** Key Vault will back dev, staging, and production secrets; local development will use developer-provisioned secrets that mirror Key Vault paths.
- **Networking:** Staging and production will adopt NSGs and private endpoints; dev will continue to use restricted public ingress until private endpoints are available.
- **Logging:** Logs will flow to Azure Monitor with consistent retention; access reviews will ensure only least-privilege roles can query sensitive logs.
