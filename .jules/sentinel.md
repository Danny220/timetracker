## 2024-05-05 - Privilege Escalation via Server Action Authorization Bypass
**Vulnerability:** The server action `inviteUser` allowed users with the `business_manager` role to invite users and elevate their roles, including elevating an invited user to the `admin` role. Although the Admin UI in `admin/page.tsx` was restricted to `admin` only, a malicious or compromised `business_manager` could manually invoke the server action directly to escalate their privileges.
**Learning:** Frontend UI authorization checks must be mirrored or enforced equivalently on the backend server actions or API endpoints to prevent Broken Access Control vulnerabilities (CWE-285/CWE-269).
**Prevention:** Ensure that server actions and endpoints consistently implement role-based access control checking that aligns precisely with the intended authorization model. Always apply the Principle of Least Privilege: only Admins should be able to create new Admins.

## 2024-05-06 - Time Entry Status Bypass via Insecure Direct Object Reference
**Vulnerability:** Regular employees could bypass leave approval policies by manually setting the `status` field to `'approved'` when upserting time entries via the Supabase client.
**Learning:** Client-side status assignments in a BaaS (Backend-as-a-Service) environment like Supabase cannot be trusted because users can inspect network requests and spoof API calls. Authorization logic mapping conditions to required statuses must reside on the backend.
**Prevention:** Use PostgreSQL triggers (and RLS policies if applicable) to enforce server-side business logic and securely override any tampered fields sent by untrusted clients.

## 2024-05-08 - Missing Input Validation and Error Leakage in Server Action
**Vulnerability:** The `inviteUser` server action in `src/app/actions/auth.ts` lacked input validation for `email` and `role`, relying entirely on database constraint errors. Additionally, it caught database errors (like invalid enum types) and returned the raw `error.message` to the client, exposing internal database schema details (e.g., enum values).
**Learning:** Server actions act as API endpoints and must have their own boundary validations, even if the database enforces constraints. Relying on DB errors can leak schema details to the client.
**Prevention:** Always validate and sanitize inputs at the server action boundary before passing them to the database. Catch errors and return generic, safe error messages to the client instead of raw exception details.
