## 2024-05-11 - Missing Form Field Bindings
**Learning:** Found an accessibility issue pattern across multiple pages (Login, Admin, Manage) where `<label>` elements were not bound to their respective input/select fields using `htmlFor` and `id` attributes. This violates the specific codebase UX/accessibility standard.
**Action:** Always ensure that when creating form elements, `<label>` elements are strictly bound to their respective `<input>` or `<select>` fields using `htmlFor` and `id` to improve screen reader accessibility.
