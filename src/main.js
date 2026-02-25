import './style.css'
import { addTodo, toggleTodo, removeTodo, renderTodoList } from './todos.js'

document.querySelector('#app').innerHTML = `
  <div class="todo-app">
    <h1>Todo List</h1>
    <form class="todo-form" id="todo-form">
      <input type="text" class="todo-form__input" id="todo-input" placeholder="What needs to be done?" autocomplete="off" />
      <button type="submit" class="todo-form__submit">Add</button>
    </form>
    <ul class="todo-list" id="todo-list"></ul>
  </div>
`

const form = document.getElementById('todo-form')
const input = document.getElementById('todo-input')
const listEl = document.getElementById('todo-list')

form.addEventListener('submit', (e) => {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  addTodo(text)
  input.value = ''
  renderTodoList(listEl)
})

listEl.addEventListener('change', (e) => {
  if (e.target.classList.contains('todo-item__checkbox')) {
    const li = e.target.closest('.todo-item')
    if (li?.dataset.id) {
      toggleTodo(li.dataset.id)
      renderTodoList(listEl)
    }
  }
})

listEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('todo-item__delete')) {
    const li = e.target.closest('.todo-item')
    if (li?.dataset.id) {
      removeTodo(li.dataset.id)
      renderTodoList(listEl)
    }
  }
})

renderTodoList(listEl)
