## 2025-05-04 - WeeklyTimesheet Re-renders
**Learning:** Elevating state to compute column totals (in `Home`) causes sibling row components (`WeeklyTimesheet`) to re-render on every keystroke because the parent passes down a new prop reference or re-evaluates children. Without memoization, typing in a single input causes an O(N) re-render of all other project rows.
**Action:** Always apply `React.memo` to list row components when their parent manages aggregated state that updates frequently (like totals on keystrokes or input blur).

## 2025-06-13 - Parent-Child Render Cascade (Date Formatting)
**Learning:** Performing expensive operations like `date-fns` `format()` inside rendering loops or aggregated state calculations (like `dailySums`) can cause significant input latency when child component changes trigger parent re-renders.
**Action:** Always pre-compute static, repetitive derived state (like date strings and formatting) into descriptor objects using `useMemo` at the top level of the component, and map over these descriptors instead of calling expensive functions in the render path.
