# JWT in httpOnly cookie for session management

We use a signed JWT stored in an httpOnly cookie (30-day expiry, no refresh tokens) rather than a server-side session table. The app is self-hosted on a private Tailscale network for a small group of trusted users, so the security tradeoff of long-lived stateless tokens is acceptable. This avoids the complexity of a sessions table, token rotation, and revocation infrastructure. Logout clears the cookie client-side; the token remains technically valid until expiry but is practically unusable.

## Considered options

- **Session ID in DB** — would allow instant revocation but requires a sessions table and a DB lookup on every request.
- **Short-lived JWT + refresh tokens** — better security posture but significantly more complex to implement and maintain.
