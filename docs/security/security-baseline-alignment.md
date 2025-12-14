# Security Baseline Alignment

This memo summarizes the current security posture for the EAT platform and how it aligns with the organization-wide baseline controls. It captures what is true today and the items that will change during the migration to Azure.

## Current posture (today)
- **Environment ownership:** Production and non-production environments are isolated, with change approvals required for production deployments and infrastructure updates.
- **Authentication and authorization:** RBAC is enforced across services and tooling; privileged actions require project-level admin roles and are logged.
- **Feature-flag safety:** Feature flags gate risky or customer-facing capabilities, allowing controlled rollouts and rapid disablement.
- **Data protection:** Secrets are managed centrally (e.g., per-environment variables with limited blast radius). Sensitive data is encrypted in transit and at rest using managed defaults.
- **AI gateway controls:** AI integrations route through the centralized AI gateway with request logging, quota enforcement, and input validation where applicable.
- **Auditability:** Deployment actions, user access changes, and production data access are auditable; logs are retained according to the platform standard.

## Alignment with baseline
- **Identity and access management:** Current RBAC model aligns with least-privilege expectations; periodic access reviews are required to remain compliant.
- **Change control:** Use of approvals for production changes matches the baseline requirement for dual-control on impactful changes.
- **Operational safeguards:** Feature flags and progressive delivery satisfy baseline requirements for safe rollouts and rollback mechanisms.
- **Observability:** Centralized logging and metrics meet monitoring and alerting expectations for critical services.
- **Data handling:** Encryption defaults and secret segregation align with baseline data protection guidance.

## Upcoming changes during Azure migration
- **Identity provider:** Move to Entra ID-backed SSO and service principals for automation. All legacy accounts will be disabled after cutover.
- **Secret management:** Migration of secrets to Azure Key Vault with role-based access and per-environment vault instances.
- **Network security:** Adoption of Azure-native network security groups (NSGs) and private endpoints for service-to-service communication.
- **Logging pipeline:** Shipping platform logs to Azure Monitor and Log Analytics workspaces with updated retention policies.
- **Infrastructure policy:** Applying Azure Policy and Defender for Cloud baselines to enforce tagging, encryption, and network rules.
- **Break-glass access:** Establishing Entra emergency access accounts for incident response with time-bound monitoring.

## Risks and mitigations
- **Configuration drift during migration:** Use infrastructure-as-code validation and pre-production staging to surface drift before production cutover.
- **Secret path changes:** Coordinate application configuration updates with Key Vault provisioning; run smoke tests before enabling traffic.
- **Access gaps:** Complete RBAC mapping to Entra roles ahead of cutover; run access reviews post-migration to verify least privilege.
