/** In-memory todo list. Each item: { id, text, completed, status, importance, dueDate, category, created_at }. */
let todos = [];

const IMPORTANCE_ORDER = { high: 3, medium: 2, low: 1 };
const VALID_STATUSES = ['tasks', 'to_do', 'doing', 'completed'];

const EMPTY_STATE_MESSAGES = {
  tasks: 'Clean slate.',
  to_do: 'Nothing planned.',
  doing: 'Take it easy.',
  completed: 'Nothing done yet. No judgment.',
};

/**
 * Replaces the in-memory list with rows from the DB.
 * Expects { id, text, is_complete, status?, created_at, importance, due_date, category }.
 * If status is missing, derives from is_complete (true -> 'completed', false -> 'to_do').
 */
export function setTodosFromDb(rows) {
  todos = (rows || []).map((r) => {
    const status = r.status && VALID_STATUSES.includes(r.status) ? r.status : (r.is_complete ? 'completed' : 'to_do');
    return {
      id: String(r.id),
      text: r.text ?? '',
      completed: Boolean(r.is_complete),
      status,
      importance: r.importance && ['high', 'medium', 'low'].includes(r.importance) ? r.importance : null,
      dueDate: r.due_date ? (typeof r.due_date === 'string' ? r.due_date.slice(0, 10) : null) : null,
      category: r.category && String(r.category).trim() ? String(r.category).trim() : null,
      created_at: r.created_at || null,
    };
  });
}

/**
 * Adds a new todo. Trims text and skips if empty.
 * options: { importance?, dueDate?, category? } (all optional).
 * Returns the new todo's id, or undefined if nothing was added.
 */
export function addTodo(text, options = {}) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const id = crypto.randomUUID();
  const importance = options.importance && ['high', 'medium', 'low'].includes(options.importance) ? options.importance : null;
  todos.push({
    id,
    text: trimmed,
    completed: false,
    status: 'tasks',
    importance,
    dueDate: options.dueDate && String(options.dueDate).trim() ? String(options.dueDate).slice(0, 10) : null,
    category: options.category && String(options.category).trim() ? String(options.category).trim() : null,
    created_at: new Date().toISOString(),
  });
  return id;
}

/**
 * Returns the todo with the given id, or undefined.
 */
export function getTodo(id) {
  return todos.find((t) => t.id === id);
}

/**
 * Updates the todo with the given id. patch: { text?, importance?, dueDate?, category?, status? }.
 */
export function updateTodo(id, patch) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  if (patch.hasOwnProperty('text')) todo.text = patch.text != null ? String(patch.text).trim() : todo.text;
  if (patch.hasOwnProperty('importance')) todo.importance = patch.importance && ['high', 'medium', 'low'].includes(patch.importance) ? patch.importance : null;
  if (patch.hasOwnProperty('dueDate')) todo.dueDate = patch.dueDate && String(patch.dueDate).trim() ? String(patch.dueDate).slice(0, 10) : null;
  if (patch.hasOwnProperty('category')) todo.category = patch.category && String(patch.category).trim() ? String(patch.category).trim() : null;
  if (patch.hasOwnProperty('status') && VALID_STATUSES.includes(patch.status)) {
    todo.status = patch.status;
    todo.completed = patch.status === 'completed';
  }
}

/**
 * Sets the status of the todo (for drag-and-drop). Updates completed when status is 'completed'.
 */
export function setTodoStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) return;
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  todo.status = status;
  todo.completed = status === 'completed';
}

/**
 * Removes the todo with the given id from the list.
 */
export function removeTodo(id) {
  todos = todos.filter((t) => t.id !== id);
}

/**
 * Returns a filtered and sorted copy of the current todos for display.
 * options: { sortBy, sortOrder, filterType, filterValue }
 * sortBy: 'created' | 'dueDate' | 'importance' | 'status' | 'category'
 * sortOrder: 'asc' | 'desc'
 * filterType: 'all' | 'importance' | 'overdue' | 'dueToday' | 'noDate' | 'category'
 * filterValue: for filterType 'importance' (e.g. 'high') or 'category' (category name)
 */
export function getTodosForDisplay(options = {}) {
  const { sortBy = 'created', sortOrder = 'asc', filterType = 'all', filterValue } = options;
  let list = [...todos];

  const today = new Date().toISOString().slice(0, 10);

  if (filterType !== 'all') {
    if (filterType === 'importance' && filterValue) {
      list = list.filter((t) => t.importance === filterValue);
    } else if (filterType === 'overdue') {
      list = list.filter((t) => t.dueDate && t.dueDate < today && !t.completed);
    } else if (filterType === 'dueToday') {
      list = list.filter((t) => t.dueDate === today);
    } else if (filterType === 'noDate') {
      list = list.filter((t) => !t.dueDate);
    } else if (filterType === 'category' && filterValue) {
      list = list.filter((t) => t.category === filterValue);
    }
  }

  const cmp = (a, b) => {
    let diff = 0;
    if (sortBy === 'created') {
      const at = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
      diff = at - bt;
    } else if (sortBy === 'dueDate') {
      const ad = a.dueDate || '';
      const bd = b.dueDate || '';
      diff = ad.localeCompare(bd);
    } else if (sortBy === 'importance') {
      diff = (IMPORTANCE_ORDER[a.importance] || 0) - (IMPORTANCE_ORDER[b.importance] || 0);
    } else if (sortBy === 'status') {
      diff = (a.completed ? 1 : 0) - (b.completed ? 1 : 0);
    } else if (sortBy === 'category') {
      const ac = a.category || '';
      const bc = b.category || '';
      diff = ac.localeCompare(bc);
    }
    return sortOrder === 'desc' ? -diff : diff;
  };

  list.sort(cmp);
  return list;
}

/**
 * Returns todos for a single Kanban column (by status), sorted.
 * options: { sortBy, sortOrder } (default sortBy: 'created', sortOrder: 'asc').
 */
export function getTodosForColumn(status, options = {}) {
  const { sortBy = 'created', sortOrder = 'asc' } = options;
  return getTodosForDisplay({ sortBy, sortOrder, filterType: 'all' }).filter((t) => t.status === status);
}

/**
 * Renders one Kanban column's cards into the given container. No checkbox.
 * options: { categories = [], sortBy, sortOrder }.
 */
export function renderTodoColumn(container, status, options = {}) {
  if (!container) return;
  const categories = options.categories || [];
  const list = getTodosForColumn(status, { sortBy: options.sortBy || 'created', sortOrder: options.sortOrder || 'asc' });

  container.innerHTML = '';
  for (const todo of list) {
    container.appendChild(createTodoCardElement(todo, categories));
  }
  if (list.length === 0) {
    const msg = EMPTY_STATE_MESSAGES[status] ?? '';
    const emptyLi = document.createElement('li');
    emptyLi.className = 'kanban__empty';
    emptyLi.setAttribute('aria-live', 'polite');
    emptyLi.textContent = msg;
    container.appendChild(emptyLi);
  }

  const animateId = options?.animateId;
  if (animateId && list.some((t) => t.id === animateId)) {
    runDropInAnimation(container, animateId);
  }
}

/**
 * Renders the full Kanban board: fills each column container with cards for that status.
 * columnContainers: { tasks: HTMLElement, to_do: HTMLElement, doing: HTMLElement, completed: HTMLElement }.
 * options: { categories = [], sortBy, sortOrder, animateId }.
 */
export function renderKanbanBoard(columnContainers, options = {}) {
  if (!columnContainers) return;
  const opts = { categories: options.categories || [], sortBy: options.sortBy || 'created', sortOrder: options.sortOrder || 'asc', animateId: options.animateId };
  for (const status of VALID_STATUSES) {
    const el = columnContainers[status];
    if (el) renderTodoColumn(el, status, opts);
  }
}

/**
 * Builds one todo card DOM element (no checkbox). Used by renderTodoColumn.
 */
function createTodoCardElement(todo, categories) {
  const categoryColor = todo.category ? (categories.find((c) => c.name === todo.category)?.color || '#888') : null;
  const importanceLabel = todo.importance ? todo.importance.charAt(0).toUpperCase() + todo.importance.slice(1) : '';
  const dueLabel = todo.dueDate ? formatDueDate(todo.dueDate) : '';
  const isOverdue = todo.dueDate && todo.dueDate < new Date().toISOString().slice(0, 10) && !todo.completed;

  const li = document.createElement('li');
  li.className = 'todo-item' + (todo.completed ? ' todo-item--completed' : '') + (todo.importance ? ` todo-item--importance-${todo.importance}` : '');
  li.draggable = true;
  li.dataset.id = todo.id;
  li.dataset.status = todo.status;
  if (categoryColor) li.style.setProperty('--todo-category-color', categoryColor);
  const importanceA11y = todo.importance ? `<span class="visually-hidden">${importanceLabel} priority</span>` : '';

  const categoryOptionsHtml = categories.map((c) => `<option value="${escapeHtml(c.name)}" ${todo.category === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

  li.innerHTML = `
    <div class="todo-item__view">
      ${importanceA11y}
      <button type="button" class="todo-item__delete todo-item__delete--x" data-action="delete" aria-label="Delete">
        <svg class="todo-item__delete-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
      <div class="todo-item__header">
      </div>
      <div class="todo-item__row">
        <span class="todo-item__text">${escapeHtml(todo.text)}</span>
      </div>
      ${dueLabel ? `<p class="todo-item__due ${isOverdue ? 'todo-item__due--overdue' : ''}">Due ${escapeHtml(dueLabel)}</p>` : ''}
      <div class="todo-item__actions">
        ${categoryColor ? `<span class="todo-item__category-pill" style="color:${escapeHtml(categoryColor)}">${escapeHtml(todo.category)}</span>` : ''}
        <button type="button" class="todo-item__edit" data-action="edit" aria-label="Edit">Edit</button>
      </div>
    </div>
  `;
  return li;
}

function formatDueDate(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Animates the list item with the given id from the input field position into place.
 */
function runDropInAnimation(container, animateId) {
  const li = container.querySelector(`[data-id="${animateId}"]`);
  const inputEl = document.getElementById('todo-input');
  if (!li || !inputEl) return;
  const inputRect = inputEl.getBoundingClientRect();
  const liRect = li.getBoundingClientRect();
  const dx = inputRect.left - liRect.left;
  const dy = inputRect.top - liRect.top;
  li.style.transform = `translate(${dx}px, ${dy}px)`;
  li.style.opacity = '0.7';
  void li.offsetHeight;
  li.classList.add('todo-item--drop-in');
  const cleanup = () => {
    li.classList.remove('todo-item--drop-in');
    li.style.transform = '';
    li.style.opacity = '';
    li.removeEventListener('transitionend', onEnd);
  };
  const onEnd = (e) => {
    if (e.target === li && e.propertyName === 'transform') {
      cleanup();
    }
  };
  li.addEventListener('transitionend', onEnd);
  requestAnimationFrame(() => {
    if (!li.isConnected) return;
    li.style.transform = 'translate(0, 0)';
    li.style.opacity = '1';
  });
}

/** Escapes a string so it can be safely used in innerHTML (avoids XSS). */
function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
