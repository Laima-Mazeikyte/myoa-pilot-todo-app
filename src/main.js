/* ─────────────────────────────────────────────────────────────────────────────
   IMPORTS
   ───────────────────────────────────────────────────────────────────────────── */
import './style.css'
import { supabase } from './supabase.js'
import { renderTodoList, setTodosFromDb } from './todos.js'

/* ─────────────────────────────────────────────────────────────────────────────
   UI COPY & LABELS (designer-editable)
   All user-facing text in one place. Change here to update the interface.
   ───────────────────────────────────────────────────────────────────────────── */
const COPY = {
  // Header auth block (guest / signed-in states)
  authBlock: {
    guestLabel: 'Using as guest',
    verificationSent: (email) => `Verification email sent to ${email}. Check your inbox.`,
    signedInAs: (email) => `Signed in as ${email}`,
    signedInFallback: 'Signed in',
    createAccount: 'Create account',
    signIn: 'Sign in',
    signOut: 'Sign out',
  },
  // Auth modal (dialog title + submit button per mode)
  modal: {
    titles: {
      signin: 'Sign in',
      create: 'Create account',
      recover: 'Reset password',
      'set-password': 'Set new password',
    },
    submitLabels: {
      signin: 'Sign in',
      create: 'Create account',
      recover: 'Send reset link',
      'set-password': 'Set password',
    },
    defaultTitle: 'Sign in',
    defaultSubmit: 'Submit',
  },
  // Auth modal messages (validation + API errors)
  messages: {
    enterEmail: 'Enter your email address.',
    enterPassword: 'Enter your password.',
    enterNewPassword: 'Enter a new password.',
    passwordTooShort: 'Password must be at least 6 characters.',
    passwordsDontMatch: 'Passwords do not match.',
    rateLimit: 'Too many attempts. Please try again in a few minutes.',
    emailAlreadyRegistered: 'This email is already registered. Sign in instead.',
    createAccountError: 'Failed to create account.',
    signInError: 'Sign in failed.',
    checkEmailVerify: 'Check your email to verify. You can set a password after verifying.',
    checkEmailSetPassword: 'Check your email to verify, then you can set a password here.',
    checkEmailReset: 'Check your email for a link to reset your password.',
    passwordUpdated: 'Password updated',
    sendResetError: 'Failed to send reset email.',
    updatePasswordError: 'Failed to update password.',
  },
  // Toast (transient notifications)
  toast: {
    signedIn: 'Signed in successfully',
  },
  // Todo list
  deleteConfirm: 'Delete this item?',
}

// Timing (designer / UX tweaks)
const TOAST_DURATION_MS = 4000
const SIGN_OUT_TIMEOUT_MS = 3000

/* ─────────────────────────────────────────────────────────────────────────────
   DOM REFERENCES
   Grouped by screen area so you can see what belongs to which part of the UI.
   ───────────────────────────────────────────────────────────────────────────── */

// Auth: header block (guest state + “Signed in as …” + Sign out)
const authBlock = document.getElementById('auth-block')

// Auth: modal overlay and dialog
const authModal = document.getElementById('auth-modal')
const authModalBackdrop = document.getElementById('auth-modal-backdrop')
const authModalTitle = document.getElementById('auth-modal-title')
const authModalMessage = document.getElementById('auth-modal-message')
const authForm = document.getElementById('auth-form')
const authEmail = document.getElementById('auth-email')
const authPassword = document.getElementById('auth-password')
const authSubmit = document.getElementById('auth-submit')
const authCancel = document.getElementById('auth-cancel')
const authPasswordToggle = document.querySelector('.auth-form__password-toggle')
const authFormEmailRow = document.getElementById('auth-form-email-row')
const authFormPasswordRow = document.getElementById('auth-form-password-row')
const authFormRecover = document.getElementById('auth-form-recover')
const authFormBack = document.getElementById('auth-form-back')
const authFormSetPassword = document.getElementById('auth-form-set-password')
const authNewPassword = document.getElementById('auth-new-password')
const authPasswordConfirm = document.getElementById('auth-password-confirm')

// Todo: input form + list
const form = document.getElementById('todo-form')
const input = document.getElementById('todo-input')
const listEl = document.getElementById('todo-list')

// Toast (floating message)
const toastEl = document.getElementById('toast')

/** Current auth modal mode. Determines title, submit label, and which form rows are visible. */
let authModalMode = 'signin'

/* ─────────────────────────────────────────────────────────────────────────────
   AUTH BLOCK (header)
   Renders: “Using as guest” + buttons, or “Signed in as …” + Sign out.
   ───────────────────────────────────────────────────────────────────────────── */
function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function updateAuthBlock(user) {
  if (!authBlock) return
  if (!user) {
    authBlock.innerHTML = ''
    return
  }
  const { authBlock: ab } = COPY
  if (isAnonymous(user) && user.email) {
    authBlock.innerHTML = `
      <span class="auth-block__guest-text">${escapeHtml(ab.verificationSent(user.email))}</span>
      <div class="auth-block__buttons">
        <button type="button" class="auth-block__btn" data-auth-action="signin">${escapeHtml(ab.signIn)}</button>
      </div>
    `
  } else if (isAnonymous(user)) {
    authBlock.innerHTML = `
      <span class="auth-block__guest-text">${escapeHtml(ab.guestLabel)}</span>
      <div class="auth-block__buttons">
        <button type="button" class="auth-block__btn auth-block__btn--primary" data-auth-action="create">${escapeHtml(ab.createAccount)}</button>
        <button type="button" class="auth-block__btn" data-auth-action="signin">${escapeHtml(ab.signIn)}</button>
      </div>
    `
  } else {
    const emailLabel = user.email ? ab.signedInAs(user.email) : ab.signedInFallback
    authBlock.innerHTML = `
      <span class="auth-block__signed-in">
        <span class="auth-block__email">${escapeHtml(emailLabel)}</span>
        <button type="button" class="auth-block__btn" data-auth-action="signout">${escapeHtml(ab.signOut)}</button>
      </span>
    `
  }
}

function onAuthBlockClick(e) {
  const btn = e.target.closest('button[data-auth-action]')
  if (!btn || !authBlock.contains(btn)) return
  const action = btn.dataset.authAction
  if (action === 'signout') {
    e.preventDefault()
    e.stopPropagation()
    handleSignOut()
  } else {
    openAuthModal(action)
  }
}
if (authBlock) authBlock.addEventListener('click', onAuthBlockClick, true)

/* ─────────────────────────────────────────────────────────────────────────────
   AUTH MODAL (dialog)
   Open/close, per-mode title + submit label, form row visibility, messages.
   ───────────────────────────────────────────────────────────────────────────── */
function openAuthModal(mode) {
  authModalMode = mode
  const { modal } = COPY
  const titles = modal.titles
  const submitLabels = modal.submitLabels
  authModalTitle.textContent = titles[mode] ?? modal.defaultTitle
  authSubmit.textContent = submitLabels[mode] ?? modal.defaultSubmit
  authModalMessage.textContent = ''
  authEmail.value = ''
  authPassword.value = ''
  authPassword.type = 'password'
  if (authPasswordToggle) {
    const iconShow = authPasswordToggle.querySelector('.auth-form__password-icon--show')
    const iconHide = authPasswordToggle.querySelector('.auth-form__password-icon--hide')
    if (iconShow) iconShow.hidden = false
    if (iconHide) iconHide.hidden = true
    authPasswordToggle.setAttribute('aria-label', 'Show password')
  }
  if (authNewPassword) authNewPassword.value = ''
  if (authPasswordConfirm) authPasswordConfirm.value = ''
  authPassword.required = mode === 'signin'
  authEmail.required = mode !== 'set-password'

  if (authFormEmailRow) authFormEmailRow.hidden = mode === 'set-password'
  if (authFormPasswordRow) authFormPasswordRow.hidden = mode === 'recover' || mode === 'set-password'
  if (authFormRecover) authFormRecover.hidden = mode !== 'signin'
  if (authFormBack) authFormBack.hidden = mode !== 'recover' && mode !== 'set-password'
  if (authFormSetPassword) authFormSetPassword.hidden = mode !== 'set-password'

  authModal.hidden = false
  authModal.setAttribute('aria-hidden', 'false')
  authModalBackdrop.hidden = false
  authModalBackdrop.setAttribute('aria-hidden', 'false')
  if (mode === 'set-password' && authNewPassword) authNewPassword.focus()
  else authEmail.focus()
}

function closeAuthModal() {
  if (authModal.contains(document.activeElement)) {
    const focusTarget = authBlock?.querySelector('button, [href], input')
    if (focusTarget) focusTarget.focus()
    else document.body.focus()
  }
  authModal.hidden = true
  authModal.setAttribute('aria-hidden', 'true')
  authModalBackdrop.hidden = true
  authModalBackdrop.setAttribute('aria-hidden', 'true')
}

function setAuthMessage(text) {
  if (authModalMessage) authModalMessage.textContent = text
}

/* ─────────────────────────────────────────────────────────────────────────────
   TOAST
   Short-lived message (e.g. “Signed in successfully”). Duration in COPY/timing.
   ───────────────────────────────────────────────────────────────────────────── */
let toastHideTimeout = null
function showToast(message) {
  if (!toastEl) return
  if (toastHideTimeout) {
    clearTimeout(toastHideTimeout)
    toastHideTimeout = null
  }
  toastEl.textContent = message
  toastEl.hidden = false
  toastEl.removeAttribute('aria-hidden')
  toastHideTimeout = setTimeout(() => {
    toastEl.hidden = true
    toastEl.setAttribute('aria-hidden', 'true')
    toastHideTimeout = null
  }, TOAST_DURATION_MS)
}

/* ─────────────────────────────────────────────────────────────────────────────
   AUTH ACTIONS (sign in, create account, sign out, recover password, set password)
   These call Supabase and then update the UI (auth block, modal message, toast).
   ───────────────────────────────────────────────────────────────────────────── */
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

async function getCurrentUser() {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function isAnonymous(user) {
  return user?.is_anonymous === true
}

function handleSignOut() {
  if (!supabase) return
  updateAuthBlock({ is_anonymous: true })
  setTodosFromDb([])
  renderTodoList(listEl)
  ;(async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('signOut timeout')), SIGN_OUT_TIMEOUT_MS))
      ])
    } catch (e) {
      if (e?.name !== 'AbortError' && e?.message !== 'signOut timeout') throw e
    }
    await new Promise((resolve) => { setTimeout(() => ensureSession().then(resolve), 0) })
    const user = await getCurrentUser()
    await loadAndRenderTodos()
    updateAuthBlock(user)
  })()
}

async function handleCreateAccount(email, password) {
  const msg = COPY.messages
  const { data, error } = await supabase.auth.updateUser({ email })
  if (error) {
    if (error.status === 429 || error.message?.toLowerCase().includes('too many') || error.message?.toLowerCase().includes('rate limit')) {
      setAuthMessage(msg.rateLimit)
      return
    }
    if (error.message?.toLowerCase().includes('already') || error.code === 'user_already_exists') {
      setAuthMessage(msg.emailAlreadyRegistered)
      authModalMode = 'signin'
      authModalTitle.textContent = COPY.modal.titles.signin
      authSubmit.textContent = COPY.modal.submitLabels.signin
      authPassword.required = true
      return
    }
    setAuthMessage(error.message ?? msg.createAccountError)
    return
  }
  setAuthMessage(msg.checkEmailVerify)
  if (password && password.length >= 6) {
    const { error: pwError } = await supabase.auth.updateUser({ password })
    if (pwError) {
      if (pwError.status === 429 || pwError.message?.toLowerCase().includes('too many') || pwError.message?.toLowerCase().includes('rate limit')) {
        setAuthMessage(msg.rateLimit)
      } else {
        setAuthMessage(msg.checkEmailSetPassword)
      }
      return
    }
  }
  closeAuthModal()
  await loadAndRenderTodos()
  updateAuthBlock(data?.user ?? (await getCurrentUser()))
}

async function handleSignIn(email, password, anonymousUserId) {
  const msg = COPY.messages
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    if (error.status === 429 || error.message?.toLowerCase().includes('too many') || error.message?.toLowerCase().includes('rate limit')) {
      setAuthMessage(msg.rateLimit)
    } else {
      setAuthMessage(error.message ?? msg.signInError)
    }
    return
  }
  if (anonymousUserId) {
    const { error: rpcError } = await supabase.rpc('migrate_anonymous_todos', { from_user_id: anonymousUserId })
    if (rpcError) console.error('Failed to migrate anonymous todos:', rpcError)
  }
  closeAuthModal()
  showToast(COPY.toast.signedIn)
  await loadAndRenderTodos()
  updateAuthBlock(data?.user ?? (await getCurrentUser()))
}

async function handleRecoverPassword(email) {
  const msg = COPY.messages
  if (!supabase) return
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/'
  })
  if (error) {
    if (error.status === 429 || error.message?.toLowerCase().includes('too many') || error.message?.toLowerCase().includes('rate limit')) {
      setAuthMessage(msg.rateLimit)
    } else {
      setAuthMessage(error.message ?? msg.sendResetError)
    }
    return
  }
  setAuthMessage(msg.checkEmailReset)
}

async function handleSetNewPassword(password) {
  const msg = COPY.messages
  if (!supabase) return
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    if (error.status === 429 || error.message?.toLowerCase().includes('too many') || error.message?.toLowerCase().includes('rate limit')) {
      setAuthMessage(msg.rateLimit)
    } else {
      setAuthMessage(error.message ?? msg.updatePasswordError)
    }
    return
  }
  closeAuthModal()
  showToast(msg.passwordUpdated)
  await loadAndRenderTodos()
  updateAuthBlock(await getCurrentUser())
}

/* ─────────────────────────────────────────────────────────────────────────────
   AUTH FORM (modal) – submit + secondary actions
   Submit runs create / sign in / recover / set-password based on authModalMode.
   ───────────────────────────────────────────────────────────────────────────── */
authForm.addEventListener('submit', async (e) => {
  e.preventDefault?.()
  const msg = COPY.messages
  setAuthMessage('')
  if (!supabase) {
    setAuthMessage('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.')
    return
  }
  try {
    const email = authEmail.value.trim()
    const password = authPassword.value
    if (authModalMode === 'recover') {
      if (!email) {
        setAuthMessage(msg.enterEmail)
        return
      }
      await handleRecoverPassword(email)
      return
    }
    if (authModalMode === 'set-password') {
      const newPassword = authNewPassword?.value ?? ''
      const confirm = authPasswordConfirm?.value ?? ''
      if (!newPassword) {
        setAuthMessage(msg.enterNewPassword)
        return
      }
      if (newPassword.length < 6) {
        setAuthMessage(msg.passwordTooShort)
        return
      }
      if (newPassword !== confirm) {
        setAuthMessage(msg.passwordsDontMatch)
        return
      }
      await handleSetNewPassword(newPassword)
      return
    }
    if (!email) return
    if (authModalMode === 'create') {
      await handleCreateAccount(email, password)
    } else {
      if (!password) {
        setAuthMessage(msg.enterPassword)
        return
      }
      const user = await getCurrentUser()
      const anonymousUserId = user && isAnonymous(user) ? user.id : null
      await handleSignIn(email, password, anonymousUserId)
    }
  } catch (err) {
    setAuthMessage(err?.message ?? msg.signInError)
  }
})

authCancel.addEventListener('click', closeAuthModal)
authModalBackdrop.addEventListener('click', closeAuthModal)

authForm.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-auth-action]')
  if (!btn) return
  e.preventDefault()
  openAuthModal(btn.dataset.authAction)
})

if (authPasswordToggle) {
  const iconShow = authPasswordToggle.querySelector('.auth-form__password-icon--show')
  const iconHide = authPasswordToggle.querySelector('.auth-form__password-icon--hide')
  function syncPasswordIcons() {
    const isHidden = authPassword.type === 'password'
    if (iconShow) iconShow.hidden = !isHidden
    if (iconHide) iconHide.hidden = isHidden
  }
  syncPasswordIcons()
  authPasswordToggle.addEventListener('click', () => {
    if (authPassword.type === 'password') {
      authPassword.type = 'text'
      authPasswordToggle.setAttribute('aria-label', 'Hide password')
    } else {
      authPassword.type = 'password'
      authPasswordToggle.setAttribute('aria-label', 'Show password')
    }
    syncPasswordIcons()
  })
}

/* ─────────────────────────────────────────────────────────────────────────────
   TODO LIST
   Add todo (form submit), toggle complete (checkbox), delete (button), load + render.
   ───────────────────────────────────────────────────────────────────────────── */
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
  if (typeof setTodosFromDb !== 'function' || typeof renderTodoList !== 'function') {
    console.error('setTodosFromDb or renderTodoList missing')
    return
  }
  setTodosFromDb(data ?? [])
  renderTodoList(listEl, animateId ? { animateId } : undefined)
}

form.addEventListener('submit', async (e) => {
  e.preventDefault?.()
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

listEl.addEventListener('change', async (e) => {
  if (!e.target.classList.contains('todo-item__checkbox')) return
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
})

listEl.addEventListener('click', async (e) => {
  const deleteBtn = e.target.closest('.todo-item__delete')
  if (!deleteBtn) return
  const li = e.target.closest('.todo-item')
  const id = li?.dataset.id
  if (!id || !supabase) return
  const user = await getCurrentUser()
  if (!user) return
  if (!confirm(COPY.deleteConfirm)) return
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
})

/* ─────────────────────────────────────────────────────────────────────────────
   APP BOOT
   Load session, show auth block + todo list, subscribe to auth state changes.
   ───────────────────────────────────────────────────────────────────────────── */
async function init() {
  if (!supabase) {
    console.error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.')
    return
  }
  const hash = window.location.hash
  const isRecovery = hash.includes('type=recovery')
  const user = await ensureSession()
  if (!user) {
    console.error('Could not establish a session.')
    return
  }
  if (isRecovery) {
    openAuthModal('set-password')
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }
  await loadAndRenderTodos()
  updateAuthBlock(user)

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
      const wasOpen = !authModal.hidden
      closeAuthModal()
      if (wasOpen) showToast(COPY.toast.signedIn)
    }
    let u
    if (event === 'SIGNED_OUT') {
      u = null
    } else {
      u = session?.user ?? (await getCurrentUser())
    }
    if (event === 'SIGNED_OUT') {
      u = await new Promise((resolve) => {
        setTimeout(() => ensureSession().then(resolve), 0)
      })
      updateAuthBlock(u)
      await loadAndRenderTodos()
      return
    }
    updateAuthBlock(u)
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      await loadAndRenderTodos()
    }
  })
}

init()
