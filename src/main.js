/* Load global styles and todo data/UI helpers. */
import './style.css'
import { supabase } from './supabase.js'
import { renderTodoList, setTodosFromDb } from './todos.js'

/* DOM references: form, input, and the list container for todo items. */
const form = document.getElementById('todo-form')
const input = document.getElementById('todo-input')
const listEl = document.getElementById('todo-list')
const authBlock = document.getElementById('auth-block')
const authModal = document.getElementById('auth-modal')
const authModalBackdrop = document.getElementById('auth-modal-backdrop')
const authModalTitle = document.getElementById('auth-modal-title')
const authModalMessage = document.getElementById('auth-modal-message')
const authForm = document.getElementById('auth-form')
const authEmail = document.getElementById('auth-email')
const authPassword = document.getElementById('auth-password')
const authSubmit = document.getElementById('auth-submit')
const authCancel = document.getElementById('auth-cancel')

/** Current auth modal mode: 'create' (Create account) or 'signin' (Sign in). */
let authModalMode = 'signin'

/** Ensure a Supabase session exists (use existing or sign in anonymously). Returns the current user or null. */
async function ensureSession() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) return session.user
  const { data: { user }, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.error('Failed to sign in anonymously:', error)
    return null
  }
  return user
}

/** Get the current user from Supabase auth (assumes session already ensured). */
async function getCurrentUser() {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** Returns true if the user is anonymous (no linked email). */
function isAnonymous(user) {
  return user?.is_anonymous === true
}

/** Update the auth block UI: guest (Create account / Sign in) or signed-in (email + Sign out). */
function updateAuthBlock(user) {
  if (!authBlock) return
  if (!user) {
    authBlock.innerHTML = ''
    return
  }
  if (isAnonymous(user)) {
    authBlock.innerHTML = `
      <span class="auth-block__guest-text">Using as guest</span>
      <div class="auth-block__buttons">
        <button type="button" class="auth-block__btn auth-block__btn--primary" data-auth-action="create">Create account</button>
        <button type="button" class="auth-block__btn" data-auth-action="signin">Sign in</button>
      </div>
    `
    authBlock.querySelectorAll('[data-auth-action]').forEach((btn) => {
      btn.addEventListener('click', () => openAuthModal(btn.dataset.authAction))
    })
  } else {
    const email = user.email ?? 'Signed in'
    authBlock.innerHTML = `
      <span class="auth-block__signed-in">
        <span class="auth-block__email">Signed in as ${escapeHtml(email)}</span>
        <button type="button" class="auth-block__btn" data-auth-action="signout">Sign out</button>
      </span>
    `
    authBlock.querySelector('[data-auth-action="signout"]').addEventListener('click', handleSignOut)
  }
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function openAuthModal(mode) {
  authModalMode = mode
  authModalTitle.textContent = mode === 'create' ? 'Create account' : 'Sign in'
  authSubmit.textContent = mode === 'create' ? 'Create account' : 'Sign in'
  authModalMessage.textContent = ''
  authEmail.value = ''
  authPassword.value = ''
  authPassword.required = mode === 'signin'
  authModal.hidden = false
  authModal.setAttribute('aria-hidden', 'false')
  authModalBackdrop.hidden = false
  authModalBackdrop.setAttribute('aria-hidden', 'false')
  authEmail.focus()
}

function closeAuthModal() {
  authModal.hidden = true
  authModal.setAttribute('aria-hidden', 'true')
  authModalBackdrop.hidden = true
  authModalBackdrop.setAttribute('aria-hidden', 'true')
}

function setAuthMessage(text) {
  authModalMessage.textContent = text
}

/** Sign out, then ensure a new anonymous session and refresh UI. */
async function handleSignOut() {
  if (!supabase) return
  await supabase.auth.signOut()
  const user = await ensureSession()
  await loadAndRenderTodos()
  updateAuthBlock(user)
}

/** Create account: link email (and optionally password) to anonymous user via updateUser. */
async function handleCreateAccount(email, password) {
  const { data, error } = await supabase.auth.updateUser({ email })
  if (error) {
    if (error.message?.toLowerCase().includes('already') || error.code === 'user_already_exists') {
      setAuthMessage('This email is already registered. Sign in instead.')
      authModalMode = 'signin'
      authModalTitle.textContent = 'Sign in'
      authSubmit.textContent = 'Sign in'
      authPassword.required = true
      return
    }
    setAuthMessage(error.message ?? 'Failed to create account.')
    return
  }
  setAuthMessage('Check your email to verify. You can set a password after verifying.')
  if (password && password.length >= 6) {
    const { error: pwError } = await supabase.auth.updateUser({ password })
    if (pwError) {
      setAuthMessage('Check your email to verify, then you can set a password here.')
      return
    }
  }
  closeAuthModal()
  await loadAndRenderTodos()
  updateAuthBlock(data?.user ?? (await getCurrentUser()))
}

/** Sign in: store anonymous id, sign in with password, then migrate anonymous todos to this account. */
async function handleSignIn(email, password, anonymousUserId) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    setAuthMessage(error.message ?? 'Sign in failed.')
    return
  }
  if (anonymousUserId) {
    const { error: rpcError } = await supabase.rpc('migrate_anonymous_todos', { from_user_id: anonymousUserId })
    if (rpcError) console.error('Failed to migrate anonymous todos:', rpcError)
  }
  closeAuthModal()
  await loadAndRenderTodos()
  updateAuthBlock(data?.user ?? (await getCurrentUser()))
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = authEmail.value.trim()
  const password = authPassword.value
  if (!email) return
  setAuthMessage('')
  if (authModalMode === 'create') {
    await handleCreateAccount(email, password)
  } else {
    if (!password) {
      setAuthMessage('Enter your password.')
      return
    }
    const user = await getCurrentUser()
    const anonymousUserId = user && isAnonymous(user) ? user.id : null
    await handleSignIn(email, password, anonymousUserId)
  }
})

authCancel.addEventListener('click', closeAuthModal)
authModalBackdrop.addEventListener('click', closeAuthModal)

/* On form submit: insert todo into Supabase, clear input, then refresh the list. */
form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const text = input.value.trim()
  if (!text) return
  if (!supabase) {
    console.error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to valid values.')
    return
  }
  const user = await getCurrentUser()
  if (!user) {
    console.error('Not signed in. Cannot add todo.')
    return
  }
  input.value = ''
  const { data, error } = await supabase
    .from('todos')
    .insert({ text, is_complete: false, user_id: user.id })
    .select('id')
    .single()
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
    const user = await getCurrentUser()
    if (!user) return
    const isComplete = e.target.checked
    const { error } = await supabase
      .from('todos')
      .update({ is_complete: isComplete })
      .eq('id', id)
      .eq('user_id', user.id)
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
    const user = await getCurrentUser()
    if (!user) return
    const { error } = await supabase
      .from('todos')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) {
      console.error('Failed to delete todo:', error)
      return
    }
    await loadAndRenderTodos()
  }
})

/* Load todos from Supabase for the current user (ordered by created_at ascending) and render. */
async function loadAndRenderTodos(animateId) {
  const user = await getCurrentUser()
  if (!user) return
  const { data, error } = await supabase
    .from('todos')
    .select('id, text, is_complete, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  if (error) {
    console.error('Failed to load todos:', error)
    return
  }
  setTodosFromDb(data ?? [])
  renderTodoList(listEl, animateId ? { animateId } : undefined)
}

/* On app load: ensure session (existing or anonymous), then load the user's todos and set up auth UI. */
async function init() {
  if (!supabase) {
    console.error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to valid HTTP(S) URLs and key.')
    return
  }
  const user = await ensureSession()
  if (!user) {
    console.error('Could not establish a session.')
    return
  }
  await loadAndRenderTodos()
  updateAuthBlock(user)

  supabase.auth.onAuthStateChange(async (event, session) => {
    let u = session?.user ?? (await getCurrentUser())
    if (event === 'SIGNED_OUT') {
      u = await ensureSession()
    }
    updateAuthBlock(u)
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      await loadAndRenderTodos()
    }
  })
}

init()
