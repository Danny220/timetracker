## 2024-05-05 - Privilege Escalation via Server Action Authorization Bypass
**Vulnerability:** The server action `inviteUser` allowed users with the `business_manager` role to invite users and elevate their roles, including elevating an invited user to the `admin` role. Although the Admin UI in `admin/page.tsx` was restricted to `admin` only, a malicious or compromised `business_manager` could manually invoke the server action directly to escalate their privileges.
**Learning:** Frontend UI authorization checks must be mirrored or enforced equivalently on the backend server actions or API endpoints to prevent Broken Access Control vulnerabilities (CWE-285/CWE-269).
**Prevention:** Ensure that server actions and endpoints consistently implement role-based access control checking that aligns precisely with the intended authorization model. Always apply the Principle of Least Privilege: only Admins should be able to create new Admins.

## 2024-05-06 - Time Entry Status Bypass via Insecure Direct Object Reference
**Vulnerability:** Regular employees could bypass leave approval policies by manually setting the `status` field to `'approved'` when upserting time entries via the Supabase client.
**Learning:** Client-side status assignments in a BaaS (Backend-as-a-Service) environment like Supabase cannot be trusted because users can inspect network requests and spoof API calls. Authorization logic mapping conditions to required statuses must reside on the backend.
**Prevention:** Use PostgreSQL triggers (and RLS policies if applicable) to enforce server-side business logic and securely override any tampered fields sent by untrusted clients.

## 2024-05-09 - Information Exposure and Input Validation Bypass in Server Actions
**Vulnerability:** The server action `inviteUser` implicitly trusted the `role` and `email` input without validation and exposed database errors via `error.message`. Frontend pages (`src/app/manage/page.tsx`, `src/app/login/page.tsx`) leaked internal database schema or stack trace details directly to users via unstructured error boundary catches.
**Learning:** Returning `error.message` directly from catch blocks, particularly when interacting with databases or Server Actions, acts as a vector for leaking sensitive architectural constraints or state information to malicious clients.
**Prevention:** Strictly type-check and validate all primitive inputs within Server Actions manually before executing operations. Enforce generic error mappings mapping unexpected application errors to safe user-facing strings on all catch blocks returning to client interfaces.
