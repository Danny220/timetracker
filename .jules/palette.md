## 2026-05-08 - [Missing Form Control Bindings]
**Learning:** Found an accessibility anti-pattern in the application's forms where `<label>` elements were visually indicating input purposes but were not programmatically associated with `<input>` elements using `htmlFor` and `id` attributes. This prevents screen readers from understanding the connection and prevents users from clicking labels to focus inputs.
**Action:** Always ensure that every `<label>` element has an `htmlFor` attribute that explicitly matches the `id` of its corresponding form input (`<input>`, `<select>`, `<textarea>`).
