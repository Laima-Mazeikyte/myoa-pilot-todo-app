/** In-memory todo list. Each item: { id, text, completed, importance, dueDate, category, created_at }. */
let todos = [];

const IMPORTANCE_ORDER = { high: 3, medium: 2, low: 1 };

/**
 * Replaces the in-memory list with rows from the DB.
 * Expects { id, text, is_complete, created_at, importance, due_date, category }.
 */
export function setTodosFromDb(rows) {
  todos = (rows || []).map((r) => ({
    id: String(r.id),
    text: r.text ?? '',
    completed: Boolean(r.is_complete),
    importance: r.importance && ['high', 'medium', 'low'].includes(r.importance) ? r.importance : null,
    dueDate: r.due_date ? (typeof r.due_date === 'string' ? r.due_date.slice(0, 10) : null) : null,
    category: r.category && String(r.category).trim() ? String(r.category).trim() : null,
    created_at: r.created_at || null,
  }));
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
    importance,
    dueDate: options.dueDate && String(options.dueDate).trim() ? String(options.dueDate).slice(0, 10) : null,
    category: options.category && String(options.category).trim() ? String(options.category).trim() : null,
    created_at: new Date().toISOString(),
  });
  return id;
}

/**
 * Updates the todo with the given id. patch: { importance?, dueDate?, category? }.
 */
export function updateTodo(id, patch) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  if (patch.hasOwnProperty('importance')) todo.importance = patch.importance && ['high', 'medium', 'low'].includes(patch.importance) ? patch.importance : null;
  if (patch.hasOwnProperty('dueDate')) todo.dueDate = patch.dueDate && String(patch.dueDate).trim() ? String(patch.dueDate).slice(0, 10) : null;
  if (patch.hasOwnProperty('category')) todo.category = patch.category && String(patch.category).trim() ? String(patch.category).trim() : null;
}

/**
 * Toggles the completed state of the todo with the given id (if found).
 */
export function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
  }
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
 * Renders the todo list into the given container. Uses getTodosForDisplay with options.
 * options: { sortBy, sortOrder, filterType, filterValue, categories = [], animateId }.
 * categories: array of { name, color } for category pills and dropdowns.
 */
export function renderTodoList(container, options = {}) {
  if (!container) return;
  const categories = options.categories || [];
  const displayList = getTodosForDisplay({
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
    filterType: options.filterType,
    filterValue: options.filterValue,
  });

  container.innerHTML = '';
  for (const todo of displayList) {
    const categoryColor = todo.category ? (categories.find((c) => c.name === todo.category)?.color || '#888') : null;
    const importanceLabel = todo.importance ? todo.importance.charAt(0).toUpperCase() + todo.importance.slice(1) : '';
    const dueLabel = todo.dueDate ? formatDueDate(todo.dueDate) : '';
    const isOverdue = todo.dueDate && todo.dueDate < new Date().toISOString().slice(0, 10) && !todo.completed;

    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.completed ? ' todo-item--completed' : '');
    if (categoryColor) li.style.setProperty('--todo-category-color', categoryColor);
    li.dataset.id = todo.id;

    const categoryOptionsHtml = categories.map((c) => `<option value="${escapeHtml(c.name)}" ${todo.category === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');

    li.innerHTML = `
      <div class="todo-item__view">
        <div class="todo-item__meta">
          ${categoryColor ? `<span class="todo-item__category-pill" style="background-color:${escapeHtml(categoryColor)}">${escapeHtml(todo.category)}</span>` : ''}
          ${importanceLabel ? `<span class="todo-item__importance todo-item__importance--${todo.importance}">${escapeHtml(importanceLabel)}</span>` : ''}
          ${dueLabel ? `<span class="todo-item__due ${isOverdue ? 'todo-item__due--overdue' : ''}">${escapeHtml(dueLabel)}</span>` : ''}
        </div>
        <label class="todo-item__row">
          <input type="checkbox" class="todo-item__checkbox" ${todo.completed ? 'checked' : ''} data-action="toggle" />
          <span class="todo-item__text">${escapeHtml(todo.text)}</span>
        </label>
        <div class="todo-item__actions">
          <button type="button" class="todo-item__edit" data-action="edit" aria-label="Edit">Edit</button>
          <button type="button" class="todo-item__delete" data-action="delete" aria-label="Delete">
            <svg class="todo-item__delete-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </div>
      <div class="todo-item__edit-form" hidden>
        <label class="todo-item__edit-label">Importance
          <select class="todo-item__edit-importance" data-edit-field="importance">
            <option value="" ${!todo.importance ? 'selected' : ''}>None</option>
            <option value="high" ${todo.importance === 'high' ? 'selected' : ''}>High</option>
            <option value="medium" ${todo.importance === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="low" ${todo.importance === 'low' ? 'selected' : ''}>Low</option>
          </select>
        </label>
        <label class="todo-item__edit-label">Due date
          <input type="date" class="todo-item__edit-due" data-edit-field="dueDate" value="${todo.dueDate || ''}" />
        </label>
        <label class="todo-item__edit-label">Category
          <select class="todo-item__edit-category" data-edit-field="category">
            <option value="">None</option>
            ${categoryOptionsHtml}
          </select>
        </label>
        <div class="todo-item__edit-actions">
          <button type="button" class="todo-item__edit-save" data-action="edit-save">Save</button>
          <button type="button" class="todo-item__edit-cancel" data-action="edit-cancel">Cancel</button>
        </div>
      </div>
    `;
    container.appendChild(li);
  }

  const animateId = options?.animateId;
  if (animateId) {
    runDropInAnimation(container, animateId);
  }
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
