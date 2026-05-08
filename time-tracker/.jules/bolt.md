## 2025-05-04 - WeeklyTimesheet Re-renders
**Learning:** Elevating state to compute column totals (in `Home`) causes sibling row components (`WeeklyTimesheet`) to re-render on every keystroke because the parent passes down a new prop reference or re-evaluates children. Without memoization, typing in a single input causes an O(N) re-render of all other project rows.
**Action:** Always apply `React.memo` to list row components when their parent manages aggregated state that updates frequently (like totals on keystrokes or input blur).

## 2026-05-08 - WeeklyTimesheet Compute Overhead
**Learning:** Re-calculating formatting strings like `format(new Date(), 'yyyy-MM-dd')` and `isNonWorkingDay(dateStr)` synchronously per grid cell during mapping operations causes CPU overhead and slows down renders, especially when the component contains many cells or rows.
**Action:** When evaluating dates for a grid, pre-compute expensive repetitive properties once per prop-change using `useMemo` into an array of static descriptor objects instead of computing them dynamically on every cell render.
