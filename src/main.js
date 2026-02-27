/* Load global styles and todo data/UI helpers. */
import './style.css'
import { addTodo, toggleTodo, removeTodo, renderTodoList } from './todos.js'

/* DOM references: form, input, and the list container for todo items. */
const form = document.getElementById('todo-form')
const input = document.getElementById('todo-input')
const listEl = document.getElementById('todo-list')

/* On form submit: prevent page reload, add a todo from input text, clear input, then re-render the list. */
form.addEventListener('submit', (e) => {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  const newId = addTodo(text)
  input.value = ''
  renderTodoList(listEl, newId ? { animateId: newId } : undefined)
})

/* When a checkbox changes (toggle): find the todo by id and flip its completed state, then re-render. */
listEl.addEventListener('change', (e) => {
  if (e.target.classList.contains('todo-item__checkbox')) {
    const li = e.target.closest('.todo-item')
    if (li?.dataset.id) {
      toggleTodo(li.dataset.id)
      renderTodoList(listEl)
    }
  }
})

/* When delete button is clicked: remove the todo by id and re-render the list. */
listEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('todo-item__delete')) {
    const li = e.target.closest('.todo-item')
    if (li?.dataset.id) {
      removeTodo(li.dataset.id)
      renderTodoList(listEl)
    }
  }
})

/* Initial render: show the current todo list when the app loads. */
renderTodoList(listEl)
