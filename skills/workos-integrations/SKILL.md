---
name: workos-integrations
description: Set up identity provider integrations with WorkOS. Covers SSO, SCIM, and OAuth for 40+ providers.
---

<!-- generated -->

# WorkOS Integrations

## Step 1: Identify the Provider

Ask the user which identity provider they need to integrate. Then find it in the table below.

## Provider Lookup

| Provider                       | Type         | Doc URL |
| ------------------------------ | ------------ | ------- |
| Access People HR               | General      | workos.com/docs/integrations/access-people-hr |
| ADP                            | OIDC         | workos.com/docs/integrations/adp-oidc |
| Apple                          | General      | workos.com/docs/integrations/apple |
| Auth0                          | SAML         | workos.com/docs/integrations/auth0-saml |
| Auth0                          | Enterprise   | workos.com/docs/integrations/auth0-enterprise-connection |
| Auth0                          | Directory    | workos.com/docs/integrations/auth0-directory-sync |
| AWS Cognito                    | General      | workos.com/docs/integrations/aws-cognito |
| Bamboohr                       | General      | workos.com/docs/integrations/bamboohr |
| Breathe HR                     | General      | workos.com/docs/integrations/breathe-hr |
| Bubble                         | General      | workos.com/docs/integrations/bubble |
| CAS                            | SAML         | workos.com/docs/integrations/cas-saml |
| Cezanne HR                     | General      | workos.com/docs/integrations/cezanne |
| Classlink                      | SAML         | workos.com/docs/integrations/classlink-saml |
| Clever                         | OIDC         | workos.com/docs/integrations/clever-oidc |
| Cloudflare                     | SAML         | workos.com/docs/integrations/cloudflare-saml |
| Cyberark                       | SCIM         | workos.com/docs/integrations/cyberark-scim |
| Cyberark                       | SAML         | workos.com/docs/integrations/cyberark-saml |
| Duo                            | SAML         | workos.com/docs/integrations/duo-saml |
| Entra ID (Azure AD)            | SCIM         | workos.com/docs/integrations/entra-id-scim |
| Entra ID (Azure AD)            | SAML         | workos.com/docs/integrations/entra-id-saml |
| Entra ID (Azure AD)            | OIDC         | workos.com/docs/integrations/entra-id-oidc |
| Firebase                       | General      | workos.com/docs/integrations/firebase |
| Fourth                         | General      | workos.com/docs/integrations/fourth |
| Github                         | OAuth        | workos.com/docs/integrations/github-oauth |
| Gitlab                         | OAuth        | workos.com/docs/integrations/gitlab-oauth |
| Google Workspace               | SAML         | workos.com/docs/integrations/google-saml |
| Google Workspace               | OIDC         | workos.com/docs/integrations/google-oidc |
| Google Workspace               | OAuth        | workos.com/docs/integrations/google-oauth |
| Google Workspace               | Directory    | workos.com/docs/integrations/google-directory-sync |
| Hibob                          | General      | workos.com/docs/integrations/hibob |
| Intuit                         | OAuth        | workos.com/docs/integrations/intuit-oauth |
| Jumpcloud                      | SCIM         | workos.com/docs/integrations/jumpcloud-scim |
| Jumpcloud                      | SAML         | workos.com/docs/integrations/jumpcloud-saml |
| Keycloak                       | SAML         | workos.com/docs/integrations/keycloak-saml |
| Lastpass                       | SAML         | workos.com/docs/integrations/lastpass-saml |
| Linkedin                       | OAuth        | workos.com/docs/integrations/linkedin-oauth |
| Login.gov                      | OIDC         | workos.com/docs/integrations/login-gov-oidc |
| Microsoft                      | OAuth        | workos.com/docs/integrations/microsoft-oauth |
| Microsoft AD FS                | SAML         | workos.com/docs/integrations/microsoft-ad-fs-saml |
| Miniorange                     | SAML         | workos.com/docs/integrations/miniorange-saml |
| NetIQ                          | SAML         | workos.com/docs/integrations/net-iq-saml |
| NextAuth.js                    | General      | workos.com/docs/integrations/next-auth |
| Oidc                           | General      | workos.com/docs/integrations/oidc |
| Okta                           | SCIM         | workos.com/docs/integrations/okta-scim |
| Okta                           | SAML         | workos.com/docs/integrations/okta-saml |
| Okta                           | OIDC         | workos.com/docs/integrations/okta-oidc |
| Onelogin                       | SCIM         | workos.com/docs/integrations/onelogin-scim |
| Onelogin                       | SAML         | workos.com/docs/integrations/onelogin-saml |
| Oracle                         | SAML         | workos.com/docs/integrations/oracle-saml |
| Pingfederate                   | SCIM         | workos.com/docs/integrations/pingfederate-scim |
| Pingfederate                   | SAML         | workos.com/docs/integrations/pingfederate-saml |
| Pingone                        | SAML         | workos.com/docs/integrations/pingone-saml |
| React Native Expo              | General      | workos.com/docs/integrations/react-native-expo |
| Rippling                       | SCIM         | workos.com/docs/integrations/rippling-scim |
| Rippling                       | SAML         | workos.com/docs/integrations/rippling-saml |
| Salesforce                     | SAML         | workos.com/docs/integrations/salesforce-saml |
| Salesforce                     | OAuth        | workos.com/docs/integrations/salesforce-oauth |
| Saml                           | General      | workos.com/docs/integrations/saml |
| Scim                           | General      | workos.com/docs/integrations/scim |
| Sftp                           | General      | workos.com/docs/integrations/sftp |
| Shibboleth Generic             | SAML         | workos.com/docs/integrations/shibboleth-generic-saml |
| Shibboleth Unsolicited         | SAML         | workos.com/docs/integrations/shibboleth-unsolicited-saml |
| SimpleSAMLphp                  | General      | workos.com/docs/integrations/simple-saml-php |
| Slack                          | OAuth        | workos.com/docs/integrations/slack-oauth |
| Supabase + AuthKit             | General      | workos.com/docs/integrations/supabase-authkit |
| Supabase + WorkOS SSO          | General      | workos.com/docs/integrations/supabase-sso |
| Vercel                         | OAuth        | workos.com/docs/integrations/vercel-oauth |
| Vmware                         | SAML         | workos.com/docs/integrations/vmware-saml |
| Workday                        | General      | workos.com/docs/integrations/workday |
| Xero                           | OAuth        | workos.com/docs/integrations/xero-oauth |

## General Integration Flow

1. **WebFetch** the provider-specific doc URL from the table above
2. Follow the setup steps in the fetched documentation
3. Configure the connection in the WorkOS Dashboard
4. Test the integration with a test user

## Integration Type Decision Tree

```
What type of integration?
  |
  +-- SSO (user login)
  |     |
  |     +-- Provider supports SAML? → Use SAML connection
  |     +-- Provider supports OIDC? → Use OIDC connection
  |     +-- Provider supports both? → Prefer SAML (more enterprise-ready)
  |
  +-- Directory Sync (user provisioning)
  |     |
  |     +-- Provider supports SCIM? → Use SCIM connection
  |     +-- No SCIM? → Check for custom directory sync option
  |
  +-- OAuth (social login)
        |
        +-- Find provider in OAuth section of table
        +-- Configure OAuth app in provider's developer console
        +-- Add credentials to WorkOS Dashboard
```

## Common Setup Patterns

### SAML Configuration

Most SAML providers require:
1. An ACS URL (from WorkOS Dashboard)
2. An SP Entity ID (from WorkOS Dashboard)
3. IdP metadata URL or certificate upload

### SCIM Directory Setup

Most SCIM providers require:
1. A SCIM endpoint URL (from WorkOS Dashboard)
2. A Bearer token for authentication
3. User attribute mapping configuration

### OAuth Setup

Most OAuth providers require:
1. Create an OAuth app in the provider's developer console
2. Set the redirect URI from WorkOS Dashboard
3. Copy Client ID and Secret to WorkOS

## Verification

- [ ] Connection appears in WorkOS Dashboard
- [ ] Test SSO login succeeds with a test user
- [ ] User profile attributes map correctly
- [ ] (If SCIM) Directory sync shows users from provider

## Related Skills

- **workos-sso**: General SSO implementation and configuration
- **workos-directory-sync**: Directory Sync setup and management
- **workos-domain-verification**: Domain verification required for SSO
