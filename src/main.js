/* Load global styles and todo data/UI helpers. */
import './style.css'
import { supabase } from './supabase.js'
import { renderTodoList, setTodosFromDb } from './todos.js'

/* DOM references: form, input, and the list container for todo items. */
const form = document.getElementById('todo-form')
const input = document.getElementById('todo-input')
const listEl = document.getElementById('todo-list')

/* On form submit: insert todo into Supabase, clear input, then refresh the list. */
form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  if (!supabase) {
    console.error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to valid values.')
    return
  }
  input.value = ''
  const { data, error } = await supabase.from('todos').insert({ text, is_complete: false }).select('id').single()
  if (error) {
    console.error('Failed to insert todo:', error)
    input.value = text
    return
  }
  await loadAndRenderTodos(data?.id)
})

/* When a checkbox changes (toggle): update is_complete in Supabase by id, then refresh the display. */
listEl.addEventListener('change', async (e) => {
  if (e.target.classList.contains('todo-item__checkbox')) {
    const li = e.target.closest('.todo-item')
    const id = li?.dataset.id
    if (!id || !supabase) return
    const isComplete = e.target.checked
    const { error } = await supabase
      .from('todos')
      .update({ is_complete: isComplete })
      .eq('id', id)
    if (error) {
      console.error('Failed to toggle todo:', error)
      e.target.checked = !isComplete
      return
    }
    await loadAndRenderTodos()
  }
})

/* When delete button is clicked: delete the todo from Supabase by id, then refresh the list. */
listEl.addEventListener('click', async (e) => {
  if (e.target.classList.contains('todo-item__delete')) {
    const li = e.target.closest('.todo-item')
    const id = li?.dataset.id
    if (!id || !supabase) return
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (error) {
      console.error('Failed to delete todo:', error)
      return
    }
    await loadAndRenderTodos()
  }
})

/* Load todos from Supabase (ordered by created_at ascending) and render on app load. */
async function loadAndRenderTodos(animateId) {
  const { data, error } = await supabase
    .from('todos')
    .select('id, text, is_complete, created_at')
    .order('created_at', { ascending: true })
  if (error) {
    console.error('Failed to load todos:', error)
    return
  }
  setTodosFromDb(data ?? [])
  renderTodoList(listEl, animateId ? { animateId } : undefined)
}

if (supabase) loadAndRenderTodos()
else console.error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to valid HTTP(S) URLs and key.')
