# Azure Migration Security Checklist

Use this checklist to track security work needed for the Azure cutover. Items marked "Pending" are not complete and must be closed before production migration.

## Identity and access
- [ ] **Entra SSO enablement**: Configure tenant apps for developers, SRE, and service principals; validate MFA enforcement. *(Pending)*
- [ ] **RBAC mapping**: Map existing roles to Entra groups and service principals; document least-privilege scopes for automation. *(Pending)*
- [ ] **Break-glass accounts**: Create emergency Entra accounts with monitoring and periodic access review. *(Pending)*

## Secrets and configuration
- [ ] **Key Vault provisioning**: Create per-environment vaults (dev/staging/prod) with RBAC-enabled access policies. *(Pending)*
- [ ] **Secret migration plan**: Export current secrets, align paths to Key Vault naming, and update application configuration. *(Pending)*
- [ ] **Rotation rehearsal**: Test secret rotation through CI/CD to ensure applications reload secrets without downtime. *(Pending)*

## Network and infrastructure
- [ ] **Network Security Groups (NSGs)**: Define inbound/outbound rules for app subnets; validate private endpoint reachability. *(Pending)*
- [ ] **Private endpoints**: Enable private links for databases, storage, and AI gateway connectivity. *(Pending)*
- [ ] **Azure Policy / Defender baselines**: Apply required policies for encryption, tagging, and threat protection. *(Pending)*

## Observability and logging
- [ ] **Log forwarding**: Route application and audit logs to Azure Monitor / Log Analytics with retention aligned to baseline. *(Pending)*
- [ ] **Access to sensitive logs**: Restrict log querying to least-privilege roles and enable access review alerts. *(Pending)*
- [ ] **Metrics and alerts**: Recreate production alerts in Azure Monitor; ensure on-call integrations are configured. *(Pending)*

## Application safeguards
- [x] **Feature flags**: Risky or customer-facing features are behind flags with staged promotion. *(Complete today)*
- [x] **AI gateway enforcement**: All AI calls flow through the gateway with request logging and quota controls. *(Complete today)*
- [x] **Change approvals**: Production deployments and schema changes require approver sign-off; emergency procedures documented. *(Complete today)*
- [x] **RBAC enforcement in app**: Application roles enforced for privileged actions with audit logging. *(Complete today)*

## Cutover readiness
- [ ] **Staging validation**: Run end-to-end tests against Azure staging with production-like data and traffic replay. *(Pending)*
- [ ] **Runbook updates**: Document new operational runbooks for Entra, Key Vault, and Azure networking. *(Pending)*
- [ ] **Post-migration review**: Schedule access and log review two weeks after cutover to confirm least privilege and policy compliance. *(Pending)*
