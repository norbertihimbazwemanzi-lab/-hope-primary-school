# Security Summary

**Reviewed Files**: 23
**Issues Resolved**: 16

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Hardcoded Credentials & Backdoors | `server.ts`, `src/services/authService.ts`, `src/services/adminStore.ts`, `src/pages/AdminPage.tsx` | `2650` (`server.ts`), `209` (`authService.ts`) | Fixed default admin, staff, parent, and student passwords were embedded in source code and accepted during login. | Critical | Fixed | Removed all hardcoded passwords and backdoor checks; added env-driven initial seeding (`ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`), a one-time First-Run Administrator Setup flow (`/api/auth/bootstrap-admin`), salted `scrypt`/`SHA-256` verification, and `crypto.getRandomValues` temporary password generation. |
| Missing Server Authentication & Role Checks | `server.ts`, `api/email.ts` | `2008`, `3373`, `3450` | Sensitive API routes (`/api/staff`, `/api/students`, `/api/payments`, `/api/discipline`, `/api/sms/*`, `/api/upload`, `/api/email`, `/api/sms/backup`) accepted unauthenticated callers or trusted client-supplied flags. | Critical | Fixed | Enforced signed session verification (`mha_session` HttpOnly cookie + HMAC Bearer tokens), CSRF origin validation for cookie requests, and role-based access checks (`SuperAdmin`, `Admin`, `HeadTeacher`, `DOS`, `DOD`, `Finance`, `Registrar`, `Teacher`, `Student`) across all protected endpoints. |
| Exposed Credentials in API & Cloud Payloads | `server.ts`, `src/services/adminStore.ts`, `src/services/firebaseStore.ts`, `src/services/supabaseClient.ts` | `2051` (`server.ts`), `289` (`supabaseClient.ts`), `619` (`firebaseStore.ts`) | User records returned from `/api/staff`, `/api/students`, `/api/sms/backup`, and synced to `localStorage`, Firestore, and Supabase contained plaintext passwords or raw hashes. | Critical | Fixed | Stripped plaintext passwords and server hashes before API responses, backups, and cloud sync writes; scrubbed legacy `mha_saved_credentials_v1` plaintext caches in `AdminPage.tsx` so only usernames are remembered locally. |
| Fake Email Success & Unconfigured Mail Fallbacks | `api/email.ts`, `server.ts`, `src/services/emailService.ts`, `src/components/AdminAttendanceTracker.tsx`, `src/pages/ContactPage.tsx` | `137` (`api/email.ts`), `35` (`emailService.ts`) | Email endpoints fell back to `jsonTransport: true` or a hardcoded personal Gmail address and returned `success: true` even when SMTP failed or lacked credentials. | High | Fixed | Configured strict `smtp.gmail.com:465` TLS delivery from `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `EMAIL_FROM`, returning HTTP `503`/`502` on missing configuration or delivery failure without faking success. |
| HTML / Header Injection in Outbound Emails | `server.ts`, `src/services/gmailService.ts`, `src/components/ApplicationModal.tsx`, `src/components/AdminAttendanceTracker.tsx`, `src/pages/AdminPage.tsx` | `106` (`server.ts`), `64` (`gmailService.ts`) | Visitor inquiry names, subjects, messages, and applicant fields were interpolated directly into HTML email templates and email headers. | Medium | Fixed | Added `escapeHtml` escaping across all email HTML templates and stripped `\r`/`\n` characters from email subjects and headers. |
| Unrestricted File Uploads & Path Traversal | `server.ts` | `37`, `1851` | `/api/upload` lacked authentication and accepted SVG/HTML payloads; `/uploads` static serving needed canonical path confinement. | High | Fixed | Restricted `/api/upload` to authenticated staff (and students for `homework` attachments only), enforced an extension allowlist (`jpg`, `jpeg`, `png`, `webp`, `pdf`, `doc`, `docx`, `txt`) plus 10 MB cap, and verified canonical path confinement under `/uploads` with `Content-Disposition: attachment` for non-image files. |
| Quiz Answer Key Exposure | `server.ts`, `src/components/StudentPortal.tsx` | `3465` | `GET /api/sms/homework_assignments` returned quiz `correctAnswer`, `acceptedAnswers`, and `explanation` fields to non-staff callers. | Medium | Fixed | Stripped answer keys and explanations server-side for student/unauthenticated reads and moved quiz grading/answer feedback to authenticated submission handling. |
| Missing Brute-Force Rate Limiting | `server.ts` | `389`, `2661` | Login, verification code, password reset, contact, and chat endpoints lacked request rate limiting. | Medium | Fixed | Added sliding-window `rateLimitCheck` throttling on `/api/auth/staff-login`, `/api/auth/student-login`, `/api/auth/forgot-password`, `/api/admissions/verify-code`, `/api/admissions/resend-code`, `/api/contact`, and chat routes. |
| Spreadsheet Import Parsing Hardening | `src/components/AdminAttendanceTracker.tsx`, `package.json` | `786` (`AdminAttendanceTracker.tsx`) | Client-side Excel attendance upload parsed spreadsheets without file size, formula, row-count, or prototype-key restrictions, while `xlsx@0.18.5` has known upstream advisories with no newer npm patch release. | Medium | Fixed | Enforced a 5 MB upload cap, disabled formulas/HTML/formatting (`cellFormula: false`, `cellHTML: false`, `cellNF: false`), capped imports at 2,000 rows, and filtered `__proto__`/`constructor`/`prototype` keys. |
| Vercel Serverless Routing & Ephemeral Filesystem | `vercel.json`, `api/index.ts`, `server.ts`, `api/sitemap.ts` | `16` (`server.ts`), `23` (`api/sitemap.ts`) | Writing JSON stores to `__dirname` fails on read-only Vercel serverless bundles, Express listened unconditionally at import time, and `sitemap.ts` trusted raw Host headers. | High | Fixed | Switched server storage to `/tmp/mugina-data` when `VERCEL` is set, guarded `app.listen()` behind non-serverless startup while exporting `app` via `api/index.ts`, configured `vercel.json` rewrites, and validated hostnames in `api/sitemap.ts`. |
| Unprotected Cloud Database Policies & Secrets Setup | `.env.example`, `supabase_schema.sql`, `firestore.rules` | `14` (`supabase_schema.sql`), `6` (`firestore.rules`) | `.env.example` did not document deployment variables, and Supabase/Firestore rules currently allow broad client read/write access for cross-browser static sync. | High | Needs Follow-Up | Added clean environment variable placeholders to `.env.example` (set real `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `EMAIL_FROM`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`, and `SUPABASE_SERVICE_ROLE_KEY` in Vercel project settings; rotate any previously exposed credentials; and lock down Supabase RLS & Firestore rules after moving client writes behind server APIs). |
| Transitive Dependency Advisories | `package.json` | `22`, `23` | `bun audit` reported transitive advisories in `express` (`body-parser`, `qs`), `firebase` (`@grpc/grpc-js`, `re2js`), and `xlsx@0.18.5`. | Low | Needs Follow-Up | Documented upstream advisories; consider upgrading `express` and `firebase` major/minor versions and migrating Excel exports/imports away from `xlsx` when convenient. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Session Cookies & CSRF | `server.ts`, `api/email.ts` | Issues signed `HttpOnly` session cookies (`mha_session`, `SameSite=None; Secure; Partitioned` over HTTPS) paired with Origin/Referer verification on cookie-authenticated mutations. |
| Security Headers | `server.ts`, `api/email.ts` | Sets `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and restrictive `Permissions-Policy` headers. |
| Password Reset Flow | `server.ts`, `src/pages/ResetPasswordPage.tsx` | Issues short-lived cryptographic single-use reset tokens hashed on the server (`sha256Hex`) and enforces password length checks before rotating credentials. |

---

## PoC Verification

### 1. Unauthenticated Access to Sensitive School & Backup Routes
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Sign-In and Role Verification |
| Impact | Critical |
| Affected File | `server.ts:3373`, `server.ts:3450` |
| Test Scenario | `GET /api/sms/backup` and `GET /api/sms/audit_logs` sent without an `mha_session` cookie or valid `Authorization: Bearer` token. |

#### How It Was Fixed
Added signed token/cookie verification (`verifyStaffToken` / `verifyStudentToken`) and explicit role checks (`FULL_ADMIN_ROLES`, `HeadTeacher`) on `/api/sms/backup` and restricted SMS domains.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request arrives at `app.get('/api/sms/backup')` (`server.ts:3373`) or `app.get('/api/sms/:domain')` (`server.ts:3450`) | Enters route handler |
| 2 | `verifyStaffToken(req)` returns `null` because no valid HMAC-signed cookie or Bearer token was supplied (`server.ts:3375`, `server.ts:3455`) | Role check fails (`!staffToken`) |
| 3 | Handler immediately sends `403 Forbidden` (for backup) or `401 Unauthorized` (for restricted SMS domains) (`server.ts:3377`, `server.ts:3458`) | **Handled Safely** |

#### Conclusion
**Fix Verified** - Unauthenticated requests can no longer export school backups, student grades, or audit logs.

---

### 2. Static Asset Path Traversal on `/uploads`
#### Summary
| Field | Value |
|---|---|
| Issue Type | Path Traversal |
| Impact | High |
| Affected File | `server.ts:37-48` |
| Test Scenario | `GET /uploads/%2e%2e/server.ts` attempting to break out of the upload storage folder. |

#### How It Was Fixed
Decoded paths are stripped of leading slashes, resolved canonically with `path.resolve(uploadsDir, rel)`, and verified to remain strictly inside `uploadsDir + path.sep` before static serving.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Request enters `/uploads` middleware (`server.ts:37`) with URL-encoded `..` segments | Decoded to `../server.ts` |
| 2 | `path.resolve(uploadsDir, rel)` resolves above `uploadsDir`; prefix check `!resolved.startsWith(uploadsDir + path.sep)` triggers (`server.ts:39-40`) | Traversal detected |
| 3 | Middleware returns `403 Forbidden` before invoking `express.static` (`server.ts:41`) | **Handled Safely** |

#### Conclusion
**Fix Verified** - Requests attempting to traverse outside the uploads directory are rejected with `403`.

---

### 3. Unauthenticated Email Dispatch & Fake Success on Missing SMTP Config
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unauthenticated Mail Relay & Silent Delivery Failure |
| Impact | High |
| Affected File | `api/email.ts:104-148`, `server.ts:2008-2042`, `src/services/emailService.ts:35-112` |
| Test Scenario | `POST /api/email` without credentials, or valid staff `POST /api/email` when `GMAIL_USER` / `GMAIL_APP_PASSWORD` are unset. |

#### How It Was Fixed
Added mandatory `staff` HMAC token/cookie validation on `/api/email`, removed `jsonTransport: true` and fallback personal addresses, and returned HTTP `503` when SMTP environment variables are missing.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Unauthenticated `POST /api/email` hits `api/email.ts:104` / `server.ts:2010` | `staffSession` is `null`, returns `401 Unauthorized` |
| 2 | Authenticated staff `POST /api/email` with missing `GMAIL_USER` or `GMAIL_APP_PASSWORD` reaches `api/email.ts:141` / `server.ts:2040` | Missing SMTP config detected |
| 3 | Backend returns HTTP `503` `{ success: false, configured: false }` and `emailService.ts:108` propagates `{ success: false, provider: 'error' }` | **Handled Safely** |

#### Conclusion
**Fix Verified** - Unauthenticated callers cannot send emails, and missing or failing SMTP settings are reported honestly rather than mocked as delivered.

---

### 4. Legacy Hardcoded Password Rejection & Rate Limiting
#### Summary
| Field | Value |
|---|---|
| Issue Type | Hardcoded Credentials & Unlimited Brute-Force Attempts |
| Impact | Critical |
| Affected File | `server.ts:2650-2677`, `src/services/authService.ts:209-240`, `src/pages/AdminPage.tsx:854-915` |
| Test Scenario | Repeated `POST /api/auth/staff-login` requests using old hardcoded credentials (`@0798744704` or `mugina2026`). |

#### How It Was Fixed
Removed all hardcoded password literals and plaintext comparisons; login now verifies against salted `scrypt`/`SHA-256` hashes and enforces a 10-attempt sliding window rate limit per IP and account identifier.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Login request arrives at `app.post('/api/auth/staff-login')` (`server.ts:2650`) | Identifier and password trimmed |
| 2 | On attempts 1–10, `verifyPassword()` checks against stored salted `scrypt$` hash (`server.ts:2675`) using constant-time comparison (`server.ts:158`) | Rejected with `401` |
| 3 | On attempt 11 within 15 minutes, `rateLimitCheck()` returns `allowed: false` (`server.ts:2661-2666`) | Returns `429 Too Many Requests` (`**Handled Safely**`) |

#### Conclusion
**Fix Verified** - Legacy hardcoded passwords no longer grant access and repeated brute-force guesses are throttled.

---

### 5. XSS Payload in Outbound Email Template
#### Summary
| Field | Value |
|---|---|
| Issue Type | Unsanitized HTML in Email Body |
| Impact | Medium |
| Affected File | `server.ts:1152-1175`, `src/services/gmailService.ts:80-115` |
| Test Scenario | Submitting `<img src=x onerror=alert(1)>` in the Contact page `name` or `message` field (`POST /api/contact`). |

#### How It Was Fixed
All user-supplied values are escaped via `escapeHtml()` before rendering inside HTML email templates, and `\r`/`\n` sequences are stripped from subject lines.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Contact payload enters `app.post('/api/contact')` (`server.ts:1121`) or `handleInquiryNotification` (`gmailService.ts:69`) | Untrusted strings sanitized |
| 2 | `escapeHtml()` converts `<`, `>`, `"`, `'` into `&lt;`, `&gt;`, `&quot;`, `&#039;` (`server.ts:1152-1156`, `gmailService.ts:80-84`) | Angle brackets neutralized |
| 3 | Outbound HTML email renders literal text `&lt;img src=x onerror=alert(1)&gt;` without creating executable markup | **Handled Safely** |

#### Conclusion
**Fix Verified** - User-supplied contact or application text cannot inject active HTML tags into school emails.
