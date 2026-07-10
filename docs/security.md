# JobFlow Platform Security Hardening & Compliance Guide

This guide details security procedures, key/secret rotation policies, and vulnerability scanning operations for JobFlow.

---

## 1. API Key Rotation Policy

JobFlow supports programmatic API Key rotation to minimize risks from compromised keys.
Rotation Endpoint: `POST /api/v1/tenants/:tenantId/keys/:keyId/rotate`

### How to Rotate:
1. Call the rotate endpoint using the old key ID and specify expiration days (optional):
   ```bash
   curl -X POST http://localhost:5000/api/v1/tenants/<tenantId>/keys/<keyId>/rotate \
     -H "Authorization: Bearer <user_token>" \
     -H "Content-Type: application/json" \
     -d '{"expiresDays": 30}'
   ```
2. The old API Key is instantly deleted and revoked.
3. A new raw API key string is generated and returned in the JSON response. Update client systems immediately.

---

## 2. Secrets & Database Passwords Rotation

All environment secrets must be rotated periodically (e.g. every 90 days).

### A. JWT Secret Key Rotation
1. Generate a secure, cryptographically random string (e.g. 64 characters).
2. Update the `JWT_SECRET` variable inside `.env` or Kubernetes secret manifests.
3. Perform a rolling restart of the API server.
   *Note: Rotating JWT secrets will invalidate all active user sessions, requiring users to log in again.*

### B. PostgreSQL Database Password Rotation
1. Update password inside PostgreSQL database:
   ```sql
   ALTER USER postgres WITH PASSWORD 'new_secure_password_here';
   ```
2. Update the `DATABASE_URL` connection string inside JobFlow `.env` config.
3. Perform rolling deployments of both API servers and Background Workers.

---

## 3. Dependency Vulnerability Scanning

To maintain a secure software supply chain:

### Local Audit Checking:
Before checking in code, run:
```bash
npm audit
```
This scans dependencies for known CVEs and updates package-lock.json. To automatically resolve non-breaking issues:
```bash
npm audit fix
```

### Continuous Integration (CI) Setup:
We recommend integrating **Snyk** or **GitHub Dependabot** in the workflow repository:
1. Add `.github/dependabot.yml` to trigger daily security scans of `npm` packages.
2. Integrate a build step in the CI pipeline:
   ```yaml
   - name: Run Snyk Security Scan
     run: npx snyk test --all-projects
     env:
       SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
   ```
   Builds will fail if high or critical vulnerabilities are introduced.
