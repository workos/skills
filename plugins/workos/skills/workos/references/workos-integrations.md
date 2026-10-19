---
name: workos-integrations
description: Set up identity provider integrations with WorkOS. Covers SSO, SCIM, and OAuth for 40+ providers.
---

<!-- generated:sha256:cd3ef709325d -->

# WorkOS Integrations

Ask the user which identity provider and connection type they need, find the row in the table below, and **WebFetch** that doc URL for the provider-specific steps. The slugs are not reliably guessable (`entra-id-scim`, `net-iq-saml`), so use the table rather than constructing URLs.

If this file conflicts with fetched docs, follow the docs.

## Provider Lookup

| Provider               | Type       | Doc URL                                                  |
| ---------------------- | ---------- | -------------------------------------------------------- |
| Access People HR       | General    | workos.com/docs/integrations/access-people-hr            |
| ADP                    | OIDC       | workos.com/docs/integrations/adp-oidc                    |
| Apple                  | General    | workos.com/docs/integrations/apple                       |
| Auth0                  | SAML       | workos.com/docs/integrations/auth0-saml                  |
| Auth0                  | Enterprise | workos.com/docs/integrations/auth0-enterprise-connection |
| Auth0                  | Directory  | workos.com/docs/integrations/auth0-directory-sync        |
| AWS Cognito            | General    | workos.com/docs/integrations/aws-cognito                 |
| Bamboohr               | General    | workos.com/docs/integrations/bamboohr                    |
| Breathe HR             | General    | workos.com/docs/integrations/breathe-hr                  |
| Bubble                 | General    | workos.com/docs/integrations/bubble                      |
| CAS                    | SAML       | workos.com/docs/integrations/cas-saml                    |
| Cezanne HR             | General    | workos.com/docs/integrations/cezanne                     |
| Classlink              | SAML       | workos.com/docs/integrations/classlink-saml              |
| Clever                 | OIDC       | workos.com/docs/integrations/clever-oidc                 |
| Cloudflare             | SAML       | workos.com/docs/integrations/cloudflare-saml             |
| Cyberark               | SCIM       | workos.com/docs/integrations/cyberark-scim               |
| Cyberark               | SAML       | workos.com/docs/integrations/cyberark-saml               |
| Duo                    | SAML       | workos.com/docs/integrations/duo-saml                    |
| Entra ID (Azure AD)    | SCIM       | workos.com/docs/integrations/entra-id-scim               |
| Entra ID (Azure AD)    | SAML       | workos.com/docs/integrations/entra-id-saml               |
| Entra ID (Azure AD)    | OIDC       | workos.com/docs/integrations/entra-id-oidc               |
| Firebase               | General    | workos.com/docs/integrations/firebase                    |
| Fourth                 | General    | workos.com/docs/integrations/fourth                      |
| Github                 | OAuth      | workos.com/docs/integrations/github-oauth                |
| Gitlab                 | OAuth      | workos.com/docs/integrations/gitlab-oauth                |
| Google Workspace       | SAML       | workos.com/docs/integrations/google-saml                 |
| Google Workspace       | OIDC       | workos.com/docs/integrations/google-oidc                 |
| Google Workspace       | OAuth      | workos.com/docs/integrations/google-oauth                |
| Google Workspace       | Directory  | workos.com/docs/integrations/google-directory-sync       |
| Hibob                  | General    | workos.com/docs/integrations/hibob                       |
| Intuit                 | OAuth      | workos.com/docs/integrations/intuit-oauth                |
| Jumpcloud              | SCIM       | workos.com/docs/integrations/jumpcloud-scim              |
| Jumpcloud              | SAML       | workos.com/docs/integrations/jumpcloud-saml              |
| Keycloak               | SAML       | workos.com/docs/integrations/keycloak-saml               |
| Lastpass               | SAML       | workos.com/docs/integrations/lastpass-saml               |
| Linkedin               | OAuth      | workos.com/docs/integrations/linkedin-oauth              |
| Login.gov              | OIDC       | workos.com/docs/integrations/login-gov-oidc              |
| Microsoft              | OAuth      | workos.com/docs/integrations/microsoft-oauth             |
| Microsoft AD FS        | SAML       | workos.com/docs/integrations/microsoft-ad-fs-saml        |
| Miniorange             | SAML       | workos.com/docs/integrations/miniorange-saml             |
| NetIQ                  | SAML       | workos.com/docs/integrations/net-iq-saml                 |
| NextAuth.js            | General    | workos.com/docs/integrations/next-auth                   |
| Oidc                   | General    | workos.com/docs/integrations/oidc                        |
| Okta                   | SCIM       | workos.com/docs/integrations/okta-scim                   |
| Okta                   | SAML       | workos.com/docs/integrations/okta-saml                   |
| Okta                   | OIDC       | workos.com/docs/integrations/okta-oidc                   |
| Onelogin               | SCIM       | workos.com/docs/integrations/onelogin-scim               |
| Onelogin               | SAML       | workos.com/docs/integrations/onelogin-saml               |
| Oracle                 | SAML       | workos.com/docs/integrations/oracle-saml                 |
| Pingfederate           | SCIM       | workos.com/docs/integrations/pingfederate-scim           |
| Pingfederate           | SAML       | workos.com/docs/integrations/pingfederate-saml           |
| Pingone                | SAML       | workos.com/docs/integrations/pingone-saml                |
| React Native Expo      | General    | workos.com/docs/integrations/react-native-expo           |
| Rippling               | SCIM       | workos.com/docs/integrations/rippling-scim               |
| Rippling               | SAML       | workos.com/docs/integrations/rippling-saml               |
| Sailpoint              | SCIM       | workos.com/docs/integrations/sailpoint-scim              |
| Salesforce             | SAML       | workos.com/docs/integrations/salesforce-saml             |
| Salesforce             | OAuth      | workos.com/docs/integrations/salesforce-oauth            |
| Saml                   | General    | workos.com/docs/integrations/saml                        |
| Scim                   | General    | workos.com/docs/integrations/scim                        |
| Sftp                   | General    | workos.com/docs/integrations/sftp                        |
| Shibboleth Generic     | SAML       | workos.com/docs/integrations/shibboleth-generic-saml     |
| Shibboleth Unsolicited | SAML       | workos.com/docs/integrations/shibboleth-unsolicited-saml |
| SimpleSAMLphp          | General    | workos.com/docs/integrations/simple-saml-php             |
| Slack                  | OAuth      | workos.com/docs/integrations/slack-oauth                 |
| Supabase + AuthKit     | General    | workos.com/docs/integrations/supabase-authkit            |
| Supabase + WorkOS SSO  | General    | workos.com/docs/integrations/supabase-sso                |
| Vercel                 | OAuth      | workos.com/docs/integrations/vercel-oauth                |
| Vmware                 | SAML       | workos.com/docs/integrations/vmware-saml                 |
| Workday                | General    | workos.com/docs/integrations/workday                     |
| Xero                   | OAuth      | workos.com/docs/integrations/xero-oauth                  |

## Gotchas

- **SAML**: the IdP metadata must be the actual XML (or a reachable metadata URL), not an HTML login page — pasting the login page is the most common reason a connection stays in **Draft**. Connection state moves Draft → Validating → Active.
- **SAML assertion errors** come from exact-match fields: "Recipient mismatch" means the ACS URL in the IdP differs from WorkOS; "Audience mismatch" means the SP Entity ID differs. Copy both from the connection detail page. "Response expired" is clock skew — assertions allow ~5-minute skew, so sync the IdP's clock via NTP.
- **SCIM**: the bearer token from the directory detail page is a secret — never log or commit it. The endpoint has the form `https://api.workos.com/directories/<DIR_ID>/scim/v2`. Directory state moves Inactive → Validating → Linked. If users sync but attributes are blank, the IdP is missing attribute mappings (`userName`, `name.givenName`, `name.familyName`).
- **OAuth**: the redirect URI in the provider console must exactly match `https://auth.workos.com/sso/oauth/callback/<CONNECTION_ID>`, or you get `redirect_uri_mismatch`. Start with scopes `openid`, `profile`, `email`.
- SSO requires a **verified organization domain**; without it the connection cannot be linked.

## Related Skills

- **workos-sso**: General SSO implementation and configuration
- **workos-directory-sync**: Directory Sync setup and management
- **workos-domain-verification**: Domain verification required for SSO
- **workos-admin-portal**: Let customers configure their own connections
