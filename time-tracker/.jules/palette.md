## 2024-05-11 - Missing Form Field Bindings
**Learning:** Found an accessibility issue pattern across multiple pages (Login, Admin, Manage) where `<label>` elements were not bound to their respective input/select fields using `htmlFor` and `id` attributes. This violates the specific codebase UX/accessibility standard.
**Action:** Always ensure that when creating form elements, `<label>` elements are strictly bound to their respective `<input>` or `<select>` fields using `htmlFor` and `id` to improve screen reader accessibility.

## 2026-05-16 - Div-based Grid Context Loss
**Learning:** The `WeeklyTimesheet` component uses a custom `div`-based grid instead of semantic `<table>` elements, preventing screen readers from inferring row/column contexts automatically. Interactive inputs within such grids require explicit `aria-label` attributes to compensate for missing structural context.
**Action:** Always add explicit, descriptive `aria-label` attributes (e.g. combining row headers like activity name and column headers like date) to inputs inside custom grid layouts.
