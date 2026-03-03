# Todo List

A todo app built with Vite, vanilla JavaScript, and Supabase for persistence. Organize tasks on a Kanban board with importance, due dates, and custom categories.

## Features

### Core (v1)

- Add new todos
- Mark as complete (and mark as incomplete)
- Delete a todo
- **Auth:** Use the app as a guest (anonymous); create an account or sign in to attach your todos to your account. Signing out gives you a new guest session.

### Kanban & workflow (v2)

- **Kanban board** — Four columns: **Inbox**, **To do**, **Doing**, **Completed**. Drag cards between columns to update status.
- **Add to column** — Use the **+** button on any column to add a task directly into that column.
- **Edit todo** — Edit modal to change text, importance, due date, category, and move to another column.
- **Inline edit** — Click a task’s text to edit in place; blur or Enter saves, Escape cancels.
- **Delete confirmation** — Modal confirmation before deleting a card.

### Task metadata

- **Importance** — Optional priority per todo: High, Medium, Low. Shown on cards and in add/edit flows.
- **Due date** — Optional due date; overdue items are visually highlighted.
- **Categories** — User-defined categories with name and color. **Manage categories** to add or remove; assign a category when adding or editing a todo.

### Filter & sort

- **Sort by** — Created, Due date, Importance, Category, or Status (ascending/descending).
- **Filter** — All, High importance, Overdue, Due today, No date, or by category (with category dropdown).

### UX & mobile

- **Onboarding** — Step-by-step guide for new visitors (guests), shown for the first few visits.
- **Toast** — Short-lived notifications (e.g. “Signed in successfully”).
- **Password recovery** — Forgot password and set new password (e.g. after email verification).
- **Mobile** — Hamburger menu for auth on small screens; sticky bottom add bar for quick add.
- **Add-todo modal** — When adding from the main input, a modal lets you set importance, due date, and category (or add directly via column **+** with the same options).

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
cd todo-app
```

If the app lives inside a monorepo (e.g. `myoa-pilot`):

```bash
git clone <repository-url>
cd myoa-pilot/todo-app
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

Run the migrations in the Supabase SQL Editor (Dashboard → SQL Editor), or apply via Supabase CLI. Run in order:

1. `20260228151234_create_todos_table.sql`
2. `20260228215530_add_user_todos.sql`
3. `20260228220000_migrate_anonymous_todos.sql`
4. `20260302100000_add_importance_due_date_category.sql`
5. `20260302110000_create_categories_table.sql`
6. `20260302120000_add_status.sql`

**CLI:** from project root, `supabase db push` (if Supabase CLI is linked to your project).

**Hosted Supabase:** In the Dashboard, enable **Anonymous** sign-ins and **Manual linking** under Auth → Providers so guests can use the app and later create an account or sign in (their todos are then attached to their account). Signing out creates a new anonymous session.

**If you see "column todos.user_id does not exist"** — the per-user migrations have not been applied. Open the same project in the Dashboard (the one in your `.env`), go to SQL Editor, and run the contents of `supabase/migrations/apply_user_todos_manual.sql` once.

**If you see errors about "status" or "column ... does not exist"** — ensure all migrations above, especially `20260302120000_add_status.sql`, have been run on the project in your `.env`.

### 5. Start the dev server

```bash
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

## Scripts

| Command           | Description                |
|-------------------|----------------------------|
| `npm run dev`     | Start Vite dev server      |
| `npm run build`   | Production build           |
| `npm run preview` | Preview production build   |

## Project structure

```
todo-app/
├── index.html
├── package.json
├── .env                    # your Supabase credentials (not committed)
├── src/
│   ├── main.js             # app entry, DOM, auth, modals, Kanban, filters
│   ├── todos.js            # todo state, Kanban rendering, filters/sort
│   ├── supabase.js         # Supabase client
│   └── style.css
└── supabase/
    └── migrations/         # SQL schema and migrations
        ├── 20260228151234_create_todos_table.sql
        ├── 20260228215530_add_user_todos.sql
        ├── 20260228220000_migrate_anonymous_todos.sql
        ├── 20260302100000_add_importance_due_date_category.sql
        ├── 20260302110000_create_categories_table.sql
        ├── 20260302120000_add_status.sql
        └── apply_user_todos_manual.sql   # one-off if needed
```
