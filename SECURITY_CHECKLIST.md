# WatchDog BD — Pre-Deployment Security Checklist

Follow this checklist before pushing updates or approving production deployments to Vercel.

---

## 1. Environment Secrets Setup (Vercel Dashboard)

Navigate to **Vercel Dashboard -> watch-dog-bd -> Settings -> Environment Variables**:

### [ ] 1.1 Generate & Set `SAFEMAP_SECRET`
Generate a cryptographically secure 64-character secret in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
* **Key:** `SAFEMAP_SECRET`
* **Value:** *(paste the 64-character hex string)*
* **Environments:** Production, Preview

### [ ] 1.2 Generate & Set `SAFEMAP_ADMIN_PASSWORD`
Generate a high-entropy admin password:
```bash
node -e "console.log(require('crypto').randomBytes(18).toString('base64'))"
```
* **Key:** `SAFEMAP_ADMIN_PASSWORD`
* **Value:** *(paste the password, must be >= 16 characters)*
* **Environments:** Production, Preview

### [ ] 1.3 Configure `MONGODB_URI` & Rotate Atlas Password
1. Open MongoDB Atlas -> **Database Access**.
2. Rotate the database user password (ensure it is >= 24 characters with no unencoded special characters in the URI).
3. Open **Network Access** -> Ensure IP whitelist contains `0.0.0.0/0` (required for Vercel dynamic serverless IPs) or VPC Peering.
4. Set in Vercel:
   * **Key:** `MONGODB_URI`
   * **Value:** `mongodb+srv://<USER>:<NEW_PASSWORD>@cluster0.pndf8.mongodb.net/safemap?retryWrites=true&w=majority&appName=Cluster0`
   * **Environments:** Production, Preview

---

## 2. Automated Test Suite Verification

Run the test suite locally before pushing any code to GitHub:
```bash
npm test
```
* **Requirement:** All 19 tests must pass with 0 failures:
  ```text
  ℹ tests 19
  ℹ suites 7
  ℹ pass 19
  ℹ fail 0
  ```

---

## 3. Production Deployment Protocol

1. **Commit and Push:**
   ```bash
   git add .
   git commit -m "feat(security): implement distributed rate limiting, shared token revocation, and zero-fallback policies"
   git push origin main
   ```
2. **Monitor Vercel Build Logs:**
   Ensure build completes with zero errors.
3. **Verify Live Health:**
   * Test `/api/meta` returns 200 with proper headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
   * Test Admin login at `/admin` using your new secure password.
   * Verify logout revokes access across serverless containers.
