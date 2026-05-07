## 2024-05-05 - Missing Memoization in Critical Render Path
**Learning:** In React components (like `WeeklyTimesheet.tsx`) rendering arrays of items with complex computed sub-states (e.g. checking if a day is a holiday dynamically for every single cell during re-renders), repeated invocations of date formatters and complex logic like `getEasterSunday` cause huge CPU overhead.
**Action:** When evaluating dates repetitively, implement simple module-level dictionary caching for year-based static data (like holidays) and avoid repeated `format()` calls by reusing already formatted `yyyy-MM-dd` date strings to dramatically reduce latency.

## 2023-10-25 - [Date Formatting in Render Loops]
**Learning:** `format()` from `date-fns` and recalculating holidays logic (`isNonWorkingDay`) inside React component render loops causes significant performance bottlenecks, blocking the main thread during high-frequency events like typing.
**Action:** Always pre-compute and memoize expensive date formatting and static calculations (like identifying holidays) using `useMemo` outside of component return mapping, especially when mapping over arrays to generate complex child node grids.
