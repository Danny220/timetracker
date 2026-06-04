## 2024-05-24 - [Information Exposure via Error Messages]
**Vulnerability:** Raw backend error messages (e.g., from Supabase auth) were being passed directly to the frontend UI and displayed to the user.
**Learning:** Frontend catch blocks in client components should not blindly trust and expose backend error messages, as they can leak internal system state or database constraints.
**Prevention:** Always map specific, known backend error string matches to generic, hardcoded, user-friendly strings before updating the UI state.
