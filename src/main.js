/* ─────────────────────────────────────────────────────────────────────────────
   IMPORTS
   ───────────────────────────────────────────────────────────────────────────── */
import './style.css'
import { supabase } from './supabase.js'
import { renderKanbanBoard, setTodosFromDb, updateTodo, setTodoStatus, getTodo } from './todos.js'

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
  // Onboarding guide (step-by-step for new visitors)
  onboarding: {
    title: 'How to use this app',
    steps: [
      { title: 'Add a task', text: 'Type in the input below and click "Add to inbox" to create a task. You can also set importance, due date, and category before adding.' },
      { title: 'Move tasks through columns', text: 'Drag cards between Inbox, To do, Doing, and Completed. You can also use the + button on a column to add a task there directly.' },
      { title: 'Save your todos', text: 'Create an account to store your todos so they\'re available on any device and never lost.' },
    ],
    next: 'Next',
    back: 'Back',
    createAccount: 'Create account',
    maybeLater: 'Maybe later',
  },
  // Todo list
  deleteConfirm: 'Delete this item?',
  deleteConfirmTitle: 'Delete card',
  deleteConfirmMessage: 'Are you sure you want to delete this card?',
  deleteConfirmYes: 'Yes',
  deleteConfirmCancel: 'Cancel',
  importance: 'Importance',
  dueDate: 'Due date',
  category: 'Category',
  edit: 'Edit',
  save: 'Save',
  cancel: 'Cancel',
  manageCategories: 'Manage categories',
  addCategory: 'Add category',
  sortBy: 'Sort by',
  order: 'Order',
  filter: 'Filter',
  filterAll: 'All',
  filterHighImportance: 'High importance',
  filterOverdue: 'Overdue',
  filterDueToday: 'Due today',
  filterNoDate: 'No date',
  filterByCategory: 'By category',
  sortCreated: 'Created',
  sortDueDate: 'Due date',
  sortImportance: 'Importance',
  sortCategory: 'Category',
  sortStatus: 'Status',
  orderAsc: 'Ascending',
  orderDesc: 'Descending',
  none: 'None',
}

// Timing (designer / UX tweaks)
const TOAST_DURATION_MS = 4000
const SIGN_OUT_TIMEOUT_MS = 3000
const ONBOARDING_SEEN_KEY = 'todo-app-onboarding-seen'

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

// Todo: Kanban board and column lists
const form = document.getElementById('todo-form')
const input = document.getElementById('todo-input')
const kanbanEl = document.getElementById('kanban')

function getKanbanColumnContainers() {
  return {
    tasks: document.getElementById('kanban-list-tasks'),
    to_do: document.getElementById('kanban-list-to_do'),
    doing: document.getElementById('kanban-list-doing'),
    completed: document.getElementById('kanban-list-completed'),
  }
}
// Add-todo modal (importance, due date, category when creating)
const addTodoModal = document.getElementById('add-todo-modal')
const addTodoModalBackdrop = document.getElementById('add-todo-modal-backdrop')
const addTodoModalText = document.getElementById('add-todo-modal-text')
const addTodoModalForm = document.getElementById('add-todo-modal-form')
const addTodoModalImportance = document.getElementById('add-todo-modal-importance')
const addTodoModalDueDate = document.getElementById('add-todo-modal-due-date')
const addTodoModalCategory = document.getElementById('add-todo-modal-category')
const addTodoModalTask = document.getElementById('add-todo-modal-task')
const addTodoModalClose = document.getElementById('add-todo-modal-close')
const filterSortBy = document.getElementById('filter-sort-by')
const filterSortOrder = document.getElementById('filter-sort-order')
const filterType = document.getElementById('filter-type')
const filterCategory = document.getElementById('filter-category')
const manageCategoriesBtn = document.getElementById('manage-categories-btn')
const categoriesModal = document.getElementById('categories-modal')
const categoriesModalBackdrop = document.getElementById('categories-modal-backdrop')
const categoriesModalClose = document.getElementById('categories-modal-close')
const categoriesForm = document.getElementById('categories-form')
const categoryNameInput = document.getElementById('category-name')
const categoryColorInput = document.getElementById('category-color')
const categoriesListEl = document.getElementById('categories-list')
const editTodoModal = document.getElementById('edit-todo-modal')
const editTodoModalBackdrop = document.getElementById('edit-todo-modal-backdrop')
const editTodoModalForm = document.getElementById('edit-todo-modal-form')
const editTodoModalText = document.getElementById('edit-todo-modal-text')
const editTodoModalImportance = document.getElementById('edit-todo-modal-importance')
const editTodoModalDueDate = document.getElementById('edit-todo-modal-due-date')
const editTodoModalCategory = document.getElementById('edit-todo-modal-category')
const editTodoModalStatus = document.getElementById('edit-todo-modal-status')
const editTodoModalCancel = document.getElementById('edit-todo-modal-cancel')
const deleteConfirmBackdrop = document.getElementById('delete-confirm-backdrop')
const deleteConfirmModal = document.getElementById('delete-confirm-modal')
const deleteConfirmTitle = document.getElementById('delete-confirm-title')
const deleteConfirmMessage = document.getElementById('delete-confirm-message')
const deleteConfirmYes = document.getElementById('delete-confirm-yes')
const deleteConfirmCancel = document.getElementById('delete-confirm-cancel')

// Toast (floating message)
const toastEl = document.getElementById('toast')

// Onboarding guide (new visitors)
const onboardingGuide = document.getElementById('onboarding-guide')
const onboardingText = document.getElementById('onboarding-text')

/** Id of the todo to delete when user confirms in the delete-confirm modal. */
let pendingDeleteId = null

/** Current auth modal mode. Determines title, submit label, and which form rows are visible. */
let authModalMode = 'signin'

/** Categories for current user (loaded from DB). */
let categories = []

/** Filter/sort state. */
let sortBy = 'created'
let sortOrder = 'asc'
let filterTypeVal = 'all'
let filterValue = null

/** Pending todo text when add-todo modal is open (user clicked Add with text, modal sets options). */
let pendingAddTodoText = null

/** Target status when adding from a column + button; otherwise 'tasks' (Inbox). */
let pendingAddTodoStatus = 'tasks'

/** Id of the todo being edited in the edit-todo modal. */
let editingTodoId = null

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
   ONBOARDING (step-by-step guide for new visitors)
   Shown to anonymous users until dismissed or they create an account.
   ───────────────────────────────────────────────────────────────────────────── */
let onboardingStepIndex = 0

function renderOnboardingStep() {
  if (!onboardingText) return
  const ob = COPY.onboarding
  const steps = ob.steps
  const step = steps[onboardingStepIndex] ?? steps[0]
  onboardingText.textContent = step.text
  const dots = onboardingGuide?.querySelectorAll('.onboarding__step-dot')
  if (dots) {
    dots.forEach((d, i) => {
      d.setAttribute('aria-selected', i === onboardingStepIndex ? 'true' : 'false')
      d.setAttribute('tabindex', i === onboardingStepIndex ? '0' : '-1')
    })
  }
}

function dismissOnboarding() {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
  } catch (_) {}
  if (onboardingGuide) {
    onboardingGuide.hidden = true
    onboardingGuide.setAttribute('aria-hidden', 'true')
  }
}

function showOnboardingIfNeeded(user) {
  if (!user || !isAnonymous(user)) {
    if (onboardingGuide) {
      onboardingGuide.hidden = true
      onboardingGuide.setAttribute('aria-hidden', 'true')
    }
    return
  }
  try {
    if (localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true') {
      if (onboardingGuide) {
        onboardingGuide.hidden = true
        onboardingGuide.setAttribute('aria-hidden', 'true')
      }
      return
    }
  } catch (_) {}
  onboardingStepIndex = 0
  renderOnboardingStep()
  if (onboardingGuide) {
    onboardingGuide.hidden = false
    onboardingGuide.removeAttribute('aria-hidden')
  }
}

function setupOnboardingListeners() {
  onboardingGuide?.addEventListener('click', (e) => {
    const dot = e.target.closest('.onboarding__step-dot')
    if (!dot) return
    const step = parseInt(dot.getAttribute('data-step'), 10)
    if (Number.isFinite(step) && step >= 0 && step < COPY.onboarding.steps.length) {
      onboardingStepIndex = step
      renderOnboardingStep()
    }
  })
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
  categories = []
  renderKanbanBoard(getKanbanColumnContainers(), { categories: [] })
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
  dismissOnboarding()
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
  dismissOnboarding()
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
   CATEGORIES
   Load categories for current user and populate dropdowns.
   ───────────────────────────────────────────────────────────────────────────── */
async function loadCategories() {
  const user = await getCurrentUser()
  if (!user || !supabase) return
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, color')
    .eq('user_id', user.id)
    .order('name', { ascending: true })
  if (error) {
    console.error('Failed to load categories:', error)
    return
  }
  categories = (data ?? []).map((r) => ({ id: r.id, name: r.name, color: r.color || '#888' }))
  populateCategoryDropdowns()
}

function populateCategoryDropdowns() {
  const options = categories.map((c) => `<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join('')
  if (addTodoModalCategory) {
    const current = addTodoModalCategory.value
    addTodoModalCategory.innerHTML = '<option value="">None</option>' + options
    if (categories.some((c) => c.name === current)) addTodoModalCategory.value = current
  }
  if (editTodoModalCategory) {
    const current = editTodoModalCategory.value
    editTodoModalCategory.innerHTML = '<option value="">None</option>' + options
    if (categories.some((c) => c.name === current)) editTodoModalCategory.value = current
  }
  if (filterCategory) {
    const current = filterCategory.value
    filterCategory.innerHTML = '<option value="">Select category</option>' + options
    if (categories.some((c) => c.name === current)) filterCategory.value = current
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   TODO LIST
   Add todo (form submit), toggle complete (checkbox), delete (button), load + render.
   ───────────────────────────────────────────────────────────────────────────── */
function getFilterValue() {
  if (filterTypeVal === 'importance') return 'high'
  if (filterTypeVal === 'category' && filterCategory) return filterCategory.value || null
  return null
}

async function loadAndRenderTodos(animateId) {
  const user = await getCurrentUser()
  if (!user) return
  let result = await supabase
    .from('todos')
    .select('id, text, is_complete, created_at, importance, due_date, category, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  let { data, error } = result
  if (error && (error.message || '').includes('status') && (error.message || '').includes('does not exist')) {
    result = await supabase
      .from('todos')
      .select('id, text, is_complete, created_at, importance, due_date, category')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    data = result.data
    error = result.error
  }
  if (error) {
    console.error('Failed to load todos:', error)
    return
  }
  if (typeof setTodosFromDb !== 'function' || typeof renderKanbanBoard !== 'function') {
    console.error('setTodosFromDb or renderKanbanBoard missing')
    return
  }
  setTodosFromDb(data ?? [])
  renderKanbanBoard(getKanbanColumnContainers(), {
    sortBy,
    sortOrder,
    categories,
    animateId: animateId || undefined,
  })
}

function applyFilterSortAndRender() {
  renderKanbanBoard(getKanbanColumnContainers(), {
    sortBy,
    sortOrder,
    categories,
  })
}

async function moveTodoToStatus(id, newStatus) {
  if (!id || !supabase) return
  const user = await getCurrentUser()
  if (!user) return
  let result = await supabase
    .from('todos')
    .update({ status: newStatus })
    .eq('id', id)
    .eq('user_id', user.id)
  if (result.error && (result.error.message || '').includes('status') && (result.error.message || '').includes('does not exist')) {
    result = await supabase
      .from('todos')
      .update({ is_complete: newStatus === 'completed' })
      .eq('id', id)
      .eq('user_id', user.id)
  }
  if (result.error) {
    console.error('Failed to move todo:', result.error)
    return
  }
  setTodoStatus(id, newStatus)
  applyFilterSortAndRender()
}

// Drag-and-drop: cards draggable; column lists are drop targets
// Use delegated listeners so events fire reliably across browsers.
document.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.todo-item')
  if (!card) return
  const id = card.dataset.id ?? ''
  const fromStatus =
    card.dataset.status ??
    card.parentElement?.getAttribute('data-status') ??
    card.closest('.kanban__column')?.getAttribute('data-status') ??
    null
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setDragImage(card, 0, 0)
  }
  card.classList.add('todo-item--dragging')
})

document.addEventListener('dragend', (e) => {
  const card = e.target.closest('.todo-item')
  if (card) card.classList.remove('todo-item--dragging')
})

document.addEventListener('dragover', (e) => {
  const list = e.target.closest('.kanban__list')
  if (!list) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
  list.classList.add('kanban__list--drag-over')
})

document.addEventListener('dragleave', (e) => {
  const list = e.target.closest('.kanban__list')
  if (!list) return
  if (!list.contains(e.relatedTarget)) list.classList.remove('kanban__list--drag-over')
})

document.addEventListener('drop', (e) => {
  const list = e.target.closest('.kanban__list')
  if (!list) return
  e.preventDefault()
  list.classList.remove('kanban__list--drag-over')
  const id = e.dataTransfer ? e.dataTransfer.getData('text/plain') : ''
  const columnStatus = list.parentElement?.getAttribute('data-status')
  if (id && columnStatus) moveTodoToStatus(id, columnStatus)
})

form.addEventListener('submit', (e) => {
  e.preventDefault?.()
  const text = input.value.trim()
  if (!text) return
  if (!supabase) {
    console.error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to valid values.')
    return
  }
  pendingAddTodoText = text
  pendingAddTodoStatus = 'tasks'
  input.value = ''
  openAddTodoModal()
})

// Column + button: add task directly to that column
;(kanbanEl || document).addEventListener('click', (e) => {
  const btn = e.target.closest('.kanban__add-btn')
  if (!btn) return
  e.preventDefault()
  const status = btn.getAttribute('data-add-to-status')
  if (!status) return
  if (!supabase) {
    console.error('Supabase is not configured.')
    return
  }
  pendingAddTodoText = null
  pendingAddTodoStatus = status
  openAddTodoModal()
})

function openAddTodoModal() {
  if (!addTodoModal || !addTodoModalBackdrop) return
  populateCategoryDropdowns()
  if (addTodoModalText) addTodoModalText.textContent = pendingAddTodoText ? `Add todo: "${pendingAddTodoText}"` : ''
  if (addTodoModalTask) {
    addTodoModalTask.value = pendingAddTodoText ?? ''
    addTodoModalTask.closest('.auth-form__label')?.classList.toggle('auth-form__label--hidden', !!pendingAddTodoText)
  }
  if (addTodoModalImportance) addTodoModalImportance.value = ''
  if (addTodoModalDueDate) addTodoModalDueDate.value = ''
  if (addTodoModalCategory) addTodoModalCategory.value = ''
  addTodoModal.hidden = false
  addTodoModal.setAttribute('aria-hidden', 'false')
  addTodoModalBackdrop.hidden = false
  addTodoModalBackdrop.setAttribute('aria-hidden', 'false')
  if (addTodoModalTask && !pendingAddTodoText) addTodoModalTask.focus()
  else if (addTodoModalImportance) addTodoModalImportance.focus()
}

function closeAddTodoModal() {
  if (!addTodoModal || !addTodoModalBackdrop) return
  addTodoModal.hidden = true
  addTodoModal.setAttribute('aria-hidden', 'true')
  addTodoModalBackdrop.hidden = true
  addTodoModalBackdrop.setAttribute('aria-hidden', 'true')
  pendingAddTodoText = null
  pendingAddTodoStatus = 'tasks'
  if (addTodoModalTask) addTodoModalTask.value = ''
  if (addTodoModalImportance) addTodoModalImportance.value = ''
  if (addTodoModalDueDate) addTodoModalDueDate.value = ''
  if (addTodoModalCategory) addTodoModalCategory.value = ''
}

if (addTodoModalForm) {
  addTodoModalForm.addEventListener('submit', async (e) => {
    e.preventDefault?.()
    const text = (addTodoModalTask?.value?.trim() ?? pendingAddTodoText ?? '').trim()
    if (!text || !supabase) return
    const user = await getCurrentUser()
    if (!user) {
      console.error('Not signed in. Cannot add todo.')
      return
    }
    const importance = addTodoModalImportance?.value?.trim() || null
    const dueDate = addTodoModalDueDate?.value?.trim() || null
    const category = addTodoModalCategory?.value?.trim() || null
    const status = pendingAddTodoStatus || 'tasks'
    let result = await supabase
      .from('todos')
      .insert({ text, is_complete: status === 'completed', status, user_id: user.id, importance, due_date: dueDate || null, category })
      .select('id')
      .single()
    if (result.error && (result.error.message || '').includes('status') && (result.error.message || '').includes('does not exist')) {
      result = await supabase
        .from('todos')
        .insert({ text, is_complete: status === 'completed', user_id: user.id, importance, due_date: dueDate || null, category })
        .select('id')
        .single()
    }
    const { data, error } = result
    if (error) {
      console.error('Failed to insert todo:', error)
      if (input) input.value = text
      closeAddTodoModal()
      return
    }
    closeAddTodoModal()
    await loadAndRenderTodos(data?.id)
    if (input) input.focus()
  })
}
if (addTodoModalClose) addTodoModalClose.addEventListener('click', () => {
  if (input) input.value = pendingAddTodoText ?? input.value
  closeAddTodoModal()
})
if (addTodoModalBackdrop) addTodoModalBackdrop.addEventListener('click', () => {
  if (input) input.value = pendingAddTodoText ?? input.value
  closeAddTodoModal()
})

function openEditTodoModal(id) {
  const todo = getTodo(id)
  if (!todo || !editTodoModal || !editTodoModalBackdrop) return
  editingTodoId = id
  populateCategoryDropdowns()
  if (editTodoModalText) editTodoModalText.value = todo.text
  if (editTodoModalImportance) editTodoModalImportance.value = todo.importance || ''
  if (editTodoModalDueDate) editTodoModalDueDate.value = todo.dueDate || ''
  if (editTodoModalCategory) editTodoModalCategory.value = todo.category || ''
  if (editTodoModalStatus) editTodoModalStatus.value = todo.status || 'tasks'
  editTodoModal.hidden = false
  editTodoModal.setAttribute('aria-hidden', 'false')
  editTodoModalBackdrop.hidden = false
  editTodoModalBackdrop.setAttribute('aria-hidden', 'false')
  if (editTodoModalText) editTodoModalText.focus()
}

function closeEditTodoModal() {
  if (!editTodoModal || !editTodoModalBackdrop) return
  editTodoModal.hidden = true
  editTodoModal.setAttribute('aria-hidden', 'true')
  editTodoModalBackdrop.hidden = true
  editTodoModalBackdrop.setAttribute('aria-hidden', 'true')
  editingTodoId = null
}

if (editTodoModalForm) {
  editTodoModalForm.addEventListener('submit', async (e) => {
    e.preventDefault?.()
    if (!editingTodoId || !supabase) return
    const user = await getCurrentUser()
    if (!user) return
    const text = editTodoModalText?.value?.trim() ?? ''
    const importance = editTodoModalImportance?.value?.trim() || null
    const dueDate = editTodoModalDueDate?.value?.trim() || null
    const category = editTodoModalCategory?.value?.trim() || null
    const status = editTodoModalStatus?.value?.trim() || 'tasks'
    let result = await supabase
      .from('todos')
      .update({
        text: text || getTodo(editingTodoId)?.text,
        importance,
        due_date: dueDate || null,
        category,
        status,
        is_complete: status === 'completed',
      })
      .eq('id', editingTodoId)
      .eq('user_id', user.id)
    if (result.error && (result.error.message || '').includes('status') && (result.error.message || '').includes('does not exist')) {
      result = await supabase
        .from('todos')
        .update({
          text: text || getTodo(editingTodoId)?.text,
          importance,
          due_date: dueDate || null,
          category,
          is_complete: status === 'completed',
        })
        .eq('id', editingTodoId)
        .eq('user_id', user.id)
    }
    if (result.error) {
      console.error('Failed to update todo:', result.error)
      return
    }
    const finalText = text || getTodo(editingTodoId)?.text
    updateTodo(editingTodoId, {
      text: finalText,
      importance,
      dueDate: dueDate || null,
      category,
      status,
    })
    closeEditTodoModal()
    applyFilterSortAndRender()
  })
}
if (editTodoModalCancel) editTodoModalCancel.addEventListener('click', closeEditTodoModal)
if (editTodoModalBackdrop) editTodoModalBackdrop.addEventListener('click', closeEditTodoModal)

// Filter/sort: update state and re-render (within-column order only)
if (filterSortBy) {
  filterSortBy.addEventListener('change', () => {
    sortBy = filterSortBy.value
    applyFilterSortAndRender()
  })
}
if (filterSortOrder) {
  filterSortOrder.addEventListener('change', () => {
    sortOrder = filterSortOrder.value
    applyFilterSortAndRender()
  })
}
if (filterType) {
  filterType.addEventListener('change', () => {
    filterTypeVal = filterType.value
    if (filterCategory) filterCategory.hidden = filterTypeVal !== 'category'
    applyFilterSortAndRender()
  })
}
if (filterCategory) {
  filterCategory.addEventListener('change', () => applyFilterSortAndRender())
}

// Inline edit: click on todo text replaces it with an input; blur/Enter saves, Escape cancels
;(kanbanEl || document).addEventListener('click', (e) => {
  const textEl = e.target.closest('.todo-item__text')
  if (!textEl || textEl.closest('.todo-item__text-input-wrap')) return
  const li = textEl.closest('.todo-item')
  if (!li?.dataset?.id) return
  if (li.querySelector('.todo-item__text-input')) return
  const id = li.dataset.id
  const currentText = textEl.textContent || ''
  const row = textEl.closest('.todo-item__row')
  if (!row) return
  const wrap = document.createElement('div')
  wrap.className = 'todo-item__text-input-wrap'
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'todo-item__text-input'
  input.value = currentText
  input.setAttribute('aria-label', 'Edit task')
  wrap.appendChild(input)
  textEl.replaceWith(wrap)
  input.focus()
  input.select()

  let committed = false
  function commit() {
    if (committed) return
    committed = true
    const newText = input.value.trim()
    const finalText = newText || currentText
    const span = document.createElement('span')
    span.className = 'todo-item__text'
    span.textContent = finalText
    wrap.replaceWith(span)
    if (finalText !== currentText) {
      updateTodo(id, { text: finalText })
      if (id && supabase) {
        getCurrentUser().then((user) => {
          if (!user) return
          supabase.from('todos').update({ text: finalText }).eq('id', id).eq('user_id', user.id)
        })
      }
    }
  }

  function cancel() {
    if (committed) return
    committed = true
    const span = document.createElement('span')
    span.className = 'todo-item__text'
    span.textContent = currentText
    wrap.replaceWith(span)
  }

  input.addEventListener('blur', commit, { once: true })
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault()
      commit()
    } else if (ev.key === 'Escape') {
      ev.preventDefault()
      cancel()
    }
  })
})

// Delegate card actions from Kanban (cards live in any column list)
;(kanbanEl || document).addEventListener('click', async (e) => {
  const li = e.target.closest('.todo-item')
  if (!li) return
  const id = li?.dataset.id
  const action = e.target.closest('[data-action]')?.dataset?.action

  if (action === 'edit') {
    e.preventDefault()
    openEditTodoModal(id)
    return
  }

  const deleteBtn = e.target.closest('.todo-item__delete')
  if (!deleteBtn) return
  e.preventDefault()
  if (!id || !supabase) return
  const user = await getCurrentUser()
  if (!user) return
  pendingDeleteId = id
  if (deleteConfirmTitle) deleteConfirmTitle.textContent = COPY.deleteConfirmTitle
  if (deleteConfirmMessage) deleteConfirmMessage.textContent = COPY.deleteConfirmMessage
  if (deleteConfirmYes) deleteConfirmYes.textContent = COPY.deleteConfirmYes
  if (deleteConfirmCancel) deleteConfirmCancel.textContent = COPY.deleteConfirmCancel
  if (deleteConfirmBackdrop) {
    deleteConfirmBackdrop.hidden = false
    deleteConfirmBackdrop.removeAttribute('aria-hidden')
  }
  if (deleteConfirmModal) {
    deleteConfirmModal.hidden = false
    deleteConfirmModal.removeAttribute('aria-hidden')
  }
})

function closeDeleteConfirmModal() {
  pendingDeleteId = null
  if (deleteConfirmBackdrop) {
    deleteConfirmBackdrop.hidden = true
    deleteConfirmBackdrop.setAttribute('aria-hidden', 'true')
  }
  if (deleteConfirmModal) {
    deleteConfirmModal.hidden = true
    deleteConfirmModal.setAttribute('aria-hidden', 'true')
  }
}

async function confirmDeleteTodo() {
  if (!pendingDeleteId || !supabase) return
  const user = await getCurrentUser()
  if (!user) return
  const id = pendingDeleteId
  closeDeleteConfirmModal()
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

if (deleteConfirmYes) deleteConfirmYes.addEventListener('click', () => confirmDeleteTodo())
if (deleteConfirmCancel) deleteConfirmCancel.addEventListener('click', closeDeleteConfirmModal)
if (deleteConfirmBackdrop) deleteConfirmBackdrop.addEventListener('click', closeDeleteConfirmModal)

/* ─────────────────────────────────────────────────────────────────────────────
   CATEGORIES MODAL
   Open/close, add category, list categories.
   ───────────────────────────────────────────────────────────────────────────── */
function openCategoriesModal() {
  if (!categoriesModal || !categoriesModalBackdrop) return
  renderCategoriesList()
  categoriesModal.hidden = false
  categoriesModal.setAttribute('aria-hidden', 'false')
  categoriesModalBackdrop.hidden = false
  categoriesModalBackdrop.setAttribute('aria-hidden', 'false')
  if (categoryNameInput) categoryNameInput.focus()
}

function closeCategoriesModal() {
  if (!categoriesModal || !categoriesModalBackdrop) return
  categoriesModal.hidden = true
  categoriesModal.setAttribute('aria-hidden', 'true')
  categoriesModalBackdrop.hidden = true
  categoriesModalBackdrop.setAttribute('aria-hidden', 'true')
}

function renderCategoriesList() {
  if (!categoriesListEl) return
  categoriesListEl.innerHTML = categories
    .map(
      (c) =>
        `<li class="categories-list__item">
          <span class="categories-list__pill todo-item__category-pill" style="color:${escapeHtml(c.color)}">${escapeHtml(c.name)}</span>
          ${c.id != null ? `<button type="button" class="categories-list__delete" data-category-id="${escapeHtml(String(c.id))}" aria-label="Delete category ${escapeHtml(c.name)}">
            <svg class="categories-list__delete-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>` : ''}
        </li>`
    )
    .join('')
}

if (manageCategoriesBtn) manageCategoriesBtn.addEventListener('click', openCategoriesModal)
if (categoriesModalClose) categoriesModalClose.addEventListener('click', closeCategoriesModal)
if (categoriesModalBackdrop) categoriesModalBackdrop.addEventListener('click', closeCategoriesModal)

if (categoriesForm) {
  categoriesForm.addEventListener('submit', async (e) => {
    e.preventDefault?.()
    const name = categoryNameInput?.value?.trim()
    if (!name || !supabase) return
    const user = await getCurrentUser()
    if (!user) return
    const color = categoryColorInput?.value || '#10b981'
    const { error } = await supabase.from('categories').insert({ user_id: user.id, name, color })
    if (error) {
      console.error('Failed to add category:', error)
      return
    }
    if (categoryNameInput) categoryNameInput.value = ''
    if (categoryColorInput) categoryColorInput.value = '#10b981'
    await loadCategories()
    renderCategoriesList()
    applyFilterSortAndRender()
  })
}

if (categoriesListEl) {
  categoriesListEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('.categories-list__delete')
    if (!btn || !supabase) return
    const id = btn.dataset.categoryId
    if (!id) return
    const user = await getCurrentUser()
    if (!user) return
    const { error } = await supabase.from('categories').delete().eq('id', id).eq('user_id', user.id)
    if (error) {
      console.error('Failed to delete category:', error)
      return
    }
    await loadCategories()
    renderCategoriesList()
    applyFilterSortAndRender()
  })
}

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
  await loadCategories()
  await loadAndRenderTodos()
  updateAuthBlock(user)
  setupOnboardingListeners()
  showOnboardingIfNeeded(user)

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
      await loadCategories()
      await loadAndRenderTodos()
      return
    }
    updateAuthBlock(u)
    showOnboardingIfNeeded(u)
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      await loadCategories()
      await loadAndRenderTodos()
    }
  })
}

init()
