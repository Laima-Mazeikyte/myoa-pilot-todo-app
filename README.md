# Todo List

A simple todo app built with Vite, vanilla JavaScript, and Supabase for persistence.

## Features (v1)

- Add new todos
- Mark as complete (and mark as incomplete)
- Delete a todo

## Tech stack

- **Vite** — build tool and dev server
- **Vanilla JS** — no framework
- **Supabase** — backend (PostgreSQL + real-time)

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** (comes with Node) or **pnpm** / **yarn**
- A **Supabase** project ([supabase.com](https://supabase.com))

Tested on **macOS** (darwin). Should work on Linux and Windows with the same Node version.

## Clone and run

### 1. Clone the repo

```bash
git clone <repository-url>
cd TODO-APP
```

If the app lives inside a monorepo (e.g. `myoa-pilot`):

```bash
git clone <repository-url>
cd myoa-pilot/TODO-APP
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

Create a `.env` file in the project root with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Get these from your [Supabase Dashboard](https://app.supabase.com) → Project Settings → API.

### 4. Set up the database

Run the migration in the Supabase SQL Editor (Dashboard → SQL Editor), or apply via Supabase CLI:

- **SQL Editor:** paste and run the contents of `supabase/migrations/20260228151234_create_todos_table.sql`
- **CLI:** from project root, `supabase db push` (if Supabase CLI is linked to your project)

### 5. Start the dev server

```bash
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Scripts

| Command        | Description              |
|----------------|--------------------------|
| `npm run dev`  | Start Vite dev server    |
| `npm run build`| Production build         |
| `npm run preview` | Preview production build |

## Project structure

```
TODO-APP/
├── index.html
├── package.json
├── .env                 # your Supabase credentials (not committed)
├── src/
│   ├── main.js         # app entry and DOM
│   ├── todos.js        # todo logic and Supabase calls
│   ├── supabase.js     # Supabase client
│   └── style.css
└── supabase/
    └── migrations/     # SQL schema for todos table
```
