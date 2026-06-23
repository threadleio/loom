// Mocked enterprise SSO helpers.
// No real OAuth/Azure AD integration: corporate identities are simulated.
// Domain allow-listing is intentionally left open for now; any corporate
// email resolves to a host identity.

export function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] || email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
