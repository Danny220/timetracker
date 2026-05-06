const fs = require('fs');
let code = fs.readFileSync('time-tracker/src/components/WeeklyTimesheet.tsx', 'utf8');

code = code.replace(
  /if \(existingEntries\?\.\[dateStr\] !== undefined\) \{/g,
  `if (existingEntries?.[dateStr] !== undefined && existingEntries?.[dateStr] !== '') {`
);

fs.writeFileSync('time-tracker/src/components/WeeklyTimesheet.tsx', code);
