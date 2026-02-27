/** In-memory todo list (no backend). Each item: { id, text, completed }. */
let todos = [];

/**
 * Adds a new todo. Trims text and skips if empty; creates an item with a UUID and completed: false.
 * Returns the new todo's id, or undefined if nothing was added.
 */
export function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const id = crypto.randomUUID();
  todos.push({
    id,
    text: trimmed,
    completed: false,
  });
  return id;
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
 * Renders the full todo list into the given container. Clears it first, then builds one <li> per todo
 * with checkbox, text (escaped), and delete button; adds --completed class when todo is done.
 * If options.animateId is set, runs a drop-in animation from the input position for that item.
 */
export function renderTodoList(container, options) {
  if (!container) return;
  container.innerHTML = '';
  for (const todo of todos) {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.completed ? ' todo-item--completed' : '');
    li.dataset.id = todo.id;
    li.innerHTML = `
      <label class="todo-item__row">
        <input type="checkbox" class="todo-item__checkbox" ${todo.completed ? 'checked' : ''} data-action="toggle" />
        <span class="todo-item__text">${escapeHtml(todo.text)}</span>
      </label>
      <button type="button" class="todo-item__delete" data-action="delete" aria-label="Delete">Delete</button>
    `;
    container.appendChild(li);
  }
  const animateId = options?.animateId;
  if (animateId) {
    runDropInAnimation(container, animateId);
  }
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
  // Set initial position WITHOUT the transition class so the browser commits this state
  // (with the class, the transition would run from identity to here and computed stays identity).
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
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
