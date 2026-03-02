-- Add optional importance, due date, and category to todos
alter table todos
  add column if not exists importance text check (importance is null or importance in ('high', 'medium', 'low')),
  add column if not exists due_date date,
  add column if not exists category text;
