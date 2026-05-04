# TimeTracker Web Application

A dynamic, bespoke Time Tracking Web Application designed to replace Kimai, built specifically for the Italian context with Next.js and Supabase.

## Features

- **Weekly Grid Interface**: "Snappy" spreadsheet-like UI for fast time entry.
- **Bulk Entry (Mass Fill)**: Instantly log 8 hours for an entire workweek.
- **Smart Italian Holidays**: Built-in, zero-latency detection of Italian public holidays (including dynamic ones like Easter Monday).
- **Conflict Resolution**: Overridable warnings when attempting to log time on weekends or holidays.

## Tech Stack

- **Frontend**: Next.js (React), Tailwind CSS, TypeScript
- **Backend/DB**: Supabase (PostgreSQL)
- **Utilities**: `date-fns` for lightweight date manipulation, `lucide-react` for icons.

---

## Step-by-Step Setup Tutorial

### 1. Prerequisites

Make sure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **npm** (comes with Node.js)
- **Docker** (Optional, but required if you want to run Supabase locally)
- A free account on [Supabase](https://supabase.com) (if deploying to the cloud).

### 2. Local Development Setup (Frontend only)

If you want to run the application immediately using the simulated API (without setting up a database yet), follow these steps:

1. **Install dependencies**:
   ```bash
   cd time-tracker
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open the App**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

*(Note: Currently, `src/utils/api.ts` uses mock data. To make it real, follow step 3).*

---

### 3. Connect to a Real Supabase Backend

To transition from the simulated prototype to a fully functional database, follow these steps:

#### Option A: Local Supabase (Requires Docker)
1. Initialize Supabase in your project folder (if not already done):
   ```bash
   npx supabase init
   ```
2. Start the local Supabase instance:
   ```bash
   npx supabase start
   ```
3. Apply the initial schema:
   The schema file is already located at `supabase/migrations/00000_initial_schema.sql`. Running `npx supabase start` should automatically apply it. If it doesn't, you can run:
   ```bash
   npx supabase migration up
   ```
4. Copy the local `API URL` and `publishable api key` provided in the terminal output and paste them into a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-local-publishable-key
   ```

#### Option B: Cloud Supabase (Production)
1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Navigate to the **SQL Editor** in your Supabase dashboard.
3. Open the file `supabase/migrations/00000_initial_schema.sql` from this repository, copy its contents, and run it in the Supabase SQL Editor.
4. Go to **Project Settings -> API** and copy your `Project URL` and `Publishable API` key.
5. Create a `.env.local` file in the root of the `time-tracker` folder:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-production-publishable-key
   ```

### 4. Wire up the Real API
Once your database is running and populated, open `src/utils/api.ts`. Replace the mock functions with actual Supabase client queries. For example:

```typescript
import { supabase } from './supabase';

export async function fetchActivities() {
  const { data, error } = await supabase
    .from('activities')
    .select(`
      id,
      name,
      project:projects(id, name)
    `);
  if (error) throw error;
  return data;
}
```

Now restart your Next.js server, and your app will be fully connected!