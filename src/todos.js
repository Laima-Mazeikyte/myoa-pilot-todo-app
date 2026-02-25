const STORAGE_KEY = 'todos';

let todos = loadTodos();

function loadTodos() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

export function getTodos() {
  return todos;
}

export function addTodo(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  todos.push({
    id: crypto.randomUUID(),
    text: trimmed,
    completed: false,
  });
  saveTodos();
}

export function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  if (todo) {
    todo.completed = !todo.completed;
    saveTodos();
  }
}

export function removeTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  saveTodos();
}

export function renderTodoList(container) {
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
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
