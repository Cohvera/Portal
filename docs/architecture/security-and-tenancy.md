# Security and tenancy

## Tenant boundary

The current tenant boundary is `Company`. Business records must carry `companyId`; repository/service methods must require company context rather than infer it globally.

## Identity

The portal identity contains the selected company and effective permissions. Development identity is allowed only when `AUTH_MODE=development`. Production will map Microsoft Entra object IDs and claims to `User` and `CompanyMembership`.

## Authorization

Permissions use namespaced keys such as `inspections.write`. Core permissions use names such as `portal.admin` and `plugins.manage`. Plugins must not reuse another plugin's namespace.

## Audit

Security-sensitive actions and data mutations must emit an audit record. Audit records are append-only from the application perspective.

## Plugin isolation

A plugin receives identity/company context through published contracts. It must not query or mutate another plugin's tables directly. Cross-plugin behavior uses domain events or public APIs.
