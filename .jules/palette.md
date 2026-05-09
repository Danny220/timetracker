
## 2024-05-09 - Explicit Form Label Binding
**Learning:** Found multiple instances where form labels were placed next to inputs without an explicit `htmlFor` + `id` association. Implicit label wrapping or purely visual proximity is insufficient for accessibility; screen readers fail to consistently announce these fields, and the clickable area for checkboxes/inputs is reduced.
**Action:** Always enforce explicit `id` and `htmlFor` pairings on `<label>` elements for every form input and select element across the codebase to ensure robust a11y support and increased click targets.
