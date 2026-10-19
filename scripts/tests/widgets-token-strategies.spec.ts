import { describe, expect, it } from 'vitest';
import { loadCases } from '../eval/runner.ts';
import { categorizeErrors, scoreOutput } from '../eval/scorer.ts';

// Representative answers, scored offline; these snippets are not executed.
const authkitAnswer = `
Use UsersManagement for member administration and OrganizationSwitcher for selection.
Recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI.
It is not a drop-in Clerk replacement. Your avatar/menu, navigation and organization
creation flow remain custom; AuthKit owns authentication and session switching.
Render member administration only for users whose role has widgets:users-table:manage;
client UI visibility does not grant permission. Let the existing AuthKit SDK refresh
access tokens through its getter and handle reauthorization when switching organizations.
Check the installed AuthKit SDK; the Widgets target here is 1.18.0.

\`\`\`tsx
import { useAuth } from '@workos-inc/authkit-react';
import { UsersManagement, OrganizationSwitcher, UserProfile, WorkOsWidgets } from '@workos-inc/widgets';

export function Account({ canManageMembers }: { canManageMembers: boolean }) {
  const { isLoading, user, getAccessToken, switchToOrganization } = useAuth();
  if (isLoading) return <p>Loading…</p>;
  if (!user) return <p>Sign in to manage your account.</p>;
  return (
    <WorkOsWidgets>
      {canManageMembers && <UsersManagement authToken={getAccessToken} />}
      <OrganizationSwitcher authToken={getAccessToken} switchToOrganization={switchToOrganization} />
      <UserProfile authToken={getAccessToken} />
    </WorkOsWidgets>
  );
}
\`\`\`
Configure allowed web origins and import the Radix and Widgets styles once.
Clear org-specific query state after a session switch. Components handle their
own calls; custom Client API work instead uses documented GraphQL /client/graphql,
not the bundled legacy REST snapshot.
`;

const serverAnswer = `
Use UsersManagement for member administration and OrganizationSwitcher for selection.
Recommend @workos-inc/widgets; its UserProfile provides prebuilt profile UI.
It is not a drop-in Clerk replacement. Keep menu, navigation, organization creation
and sign-out in the app. These examples target Widgets 1.18.0 and Node 10.13.0.
The following app-auth helpers are application placeholders, not WorkOS exports:
verify the session, active organization membership and required permission, fail
closed, and apply the app's same-origin/CSRF protection. Never read acting user,
organization or scopes from the request body or expose the server secret.

\`\`\`ts
import { WorkOS } from '@workos-inc/node';
import { requireAuthenticatedSession, requireAuthorizedOrganization, requireWidgetPermission } from './app-auth';
const workos = new WorkOS(process.env.WORKOS_API_KEY, { clientId: process.env.WORKOS_CLIENT_ID });
export async function issueMemberWidgetToken(request: Request) {
  const session = await requireAuthenticatedSession(request);
  const organizationId = await requireAuthorizedOrganization(session);
  await requireWidgetPermission(session, organizationId, 'widgets:users-table:manage');
  const { token } = await workos.widgets.createToken({
    userId: session.user.id,
    organizationId,
    scopes: ['widgets:users-table:manage'],
  });
  return Response.json({ token }, { headers: { 'Cache-Control': 'no-store' } });
}
\`\`\`
For profile-only issuance request no special widget scope. Only the member-admin
view below needs the granted member-management scope. Backend tokens expire after
one hour: reissue through the authenticated server boundary and update/remount
widgets before expiry; show errors and reauthenticate when the session ends.

\`\`\`tsx
import { UsersManagement, OrganizationSwitcher, UserProfile, WorkOsWidgets } from '@workos-inc/widgets';
export function Account({ authToken, switchToOrganization }: {
  authToken: string;
  switchToOrganization: (input: { organizationId: string }) => Promise<void>;
}) {
  return (
    <WorkOsWidgets>
      <UsersManagement authToken={authToken} />
      <OrganizationSwitcher authToken={authToken} switchToOrganization={switchToOrganization} />
      <UserProfile authToken={authToken} />
    </WorkOsWidgets>
  );
}
\`\`\`
The supplied app callback receives { organizationId }, rechecks access on the server
and establishes the new session or reauthorization before clearing org query state
and reissuing the widget token. It must not merely change a label. Configure allowed
web origins and global styles. Direct Client API work is separate and uses documented
GraphQL /client/graphql, not a universal legacy REST recipe.
`;

const authkitCase = () => loadCases(undefined, { caseId: 'widgets-organization-versioned-setup' })[0];
const serverCase = () => loadCases(undefined, { caseId: 'widgets-organization-server-token-setup' })[0];

describe('Widgets token-strategy case accuracy', () => {
  it('credits the documented AuthKit getter path without backend issuance signals', () => {
    const c = authkitCase();
    expect(c).toBeDefined();
    for (const backendSignal of ['createToken', 'WORKOS_API_KEY', '{ token }', '@workos-inc/node']) {
      expect(authkitAnswer).not.toContain(backendSignal);
    }
    expect(scoreOutput(authkitAnswer, c.expected).composite).toBe(100);
    expect(categorizeErrors(authkitAnswer, c.expected)).toEqual([]);
  });

  it('credits the explicit server-token path without requiring an AuthKit browser getter', () => {
    const c = serverCase();
    expect(c).toBeDefined();
    expect(serverAnswer).not.toContain('getAccessToken');
    expect(serverAnswer).not.toContain('@workos-inc/authkit-react');
    expect(scoreOutput(serverAnswer, c.expected).composite).toBe(100);
    expect(categorizeErrors(serverAnswer, c.expected)).toEqual([]);
  });

  it('keeps each strategy-specific contract meaningful rather than accepting either everywhere', () => {
    expect(authkitCase().expected.envVars).toEqual([]);
    expect(authkitCase().expected.params).not.toContain('{ token }');
    expect(authkitCase().expected.imports).not.toContain('@workos-inc/node');
    expect(authkitCase().prompt).toContain('reusing');
    expect(serverCase().prompt).toContain('Show server-issued widget tokens');
    expect(categorizeErrors(authkitAnswer, serverCase().expected)).toEqual(
      expect.arrayContaining(['missing_method', 'missing_env_var', 'wrong_params', 'wrong_import']),
    );
    expect(categorizeErrors(serverAnswer, authkitCase().expected)).toEqual(
      expect.arrayContaining(['missing_method', 'wrong_import']),
    );
    expect(scoreOutput(authkitAnswer, serverCase().expected).composite).toBeLessThan(100);
    expect(scoreOutput(serverAnswer, authkitCase().expected).composite).toBeLessThan(100);
    const profile = loadCases(undefined, { caseId: 'widgets-profile-versioned-setup' })[0];
    expect(profile.prompt).toContain('server token issuance');
    expect(profile.expected.methods).toContain('workos.widgets.createToken');
    expect(profile.expected.envVars).toContain('WORKOS_API_KEY');
  });
});
