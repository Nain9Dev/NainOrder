# Security Policy

## Reporting a Vulnerability

If you discover a security issue or vulnerability in NainOrder, please report it responsibly rather than opening a public issue.

Send an email to **aitor.mendoza@naindev.com** with:
- A description of the vulnerability and its potential impact.
- Steps to reproduce or a minimal proof of concept.
- Any suggested remediation if known.

Reports receive an initial response within 48 hours, followed by a status update once verified.

## Security Model and Posture

NainOrder implements several architectural defenses:
- **Zero-Trust Error Disclosure:** RFC 7807 `ProblemDetails` translation sanitizes all `500 Internal Server Error` responses outside Development, preventing internal stack traces or connection string leakage.
- **Rate Limiting:** Fixed-window partitioning limits requests to 120 per minute per IP address on public endpoints.
- **Container Hardening:** The production container runs with an unprivileged non-root user (`uid 1654`) with explicit filesystem permissions restricted to `/app/data`.
- **Dependency Auditing:** Continuous integration gates enforce `dotnet list package --vulnerable` to prevent shipping vulnerable transitives.
