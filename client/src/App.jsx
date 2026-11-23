import { useCallback, useEffect, useMemo, useState } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { supabase, supabaseConfigured } from './supabase'
import { api } from './api'

const childrenOf = (items, id) => items.filter(item => item.parent_id === id)
const progressOf = (items, item) => {
  const children = childrenOf(items, item.id)
  return children.length
    ? Math.round(children.reduce((sum, child) => sum + progressOf(items, child), 0) / children.length)
    : item.done ? 100 : 0
}

function Icon({ children, className = '' }) {
  return <span aria-hidden="true" className={`material-symbols-outlined ${className}`}>{children}</span>
}

function Button({ children, className = '', variant = 'primary', ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>
}

function Progress({ value }) {
  return <div className="progress" aria-label={`${value}% complete`}><span style={{ width: `${value}%` }} /></div>
}

function useItems(isPrivate = false) {
  const [items, setItems] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const query = `?private=${isPrivate}`
  const load = useCallback(async () => {
    setError('')
    try {
      setItems(await api(`/items${query}`))
    } catch (reason) {
      setError(reason.message || 'Could not load your plans.')
    } finally {
      setLoading(false)
    }
  }, [query])
  useEffect(() => { load() }, [load])
  const mutate = async operation => {
    setError('')
    try {
      await operation()
      await load()
    } catch (reason) {
      setError(reason.message || 'Your change could not be saved.')
    }
  }
  return {
    items, error, loading,
    add: value => mutate(() => api(`/items${query}`, { method: 'POST', body: value })),
    update: (id, value) => mutate(() => api(`/items/${id}${query}`, { method: 'PATCH', body: value })),
    remove: id => mutate(() => api(`/items/${id}${query}`, { method: 'DELETE' })),
    clearError: () => setError('')
  }
}

function ErrorNotice({ message, onClose }) {
  if (!message) return null
  return <div className="notice notice-error" role="alert">{message}{onClose && <button aria-label="Dismiss" onClick={onClose}>×</button>}</div>
}

function Landing() {
  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link className="brand" to="/"><span className="brand-mark"><Icon>checklist</Icon></span><span>Planify</span></Link>
        <nav><a href="#features">Features</a><a href="#privacy">Privacy</a></nav>
        <div className="landing-actions"><Link className="text-button" to="/auth">Log in</Link><Link className="button button-primary" to="/auth">Get started <Icon>arrow_forward</Icon></Link></div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-glow" />
          <div className="eyebrow"><Icon>auto_awesome</Icon> A little more focus, every day</div>
          <h1>Plan your goals.<br /><span>Own your progress.</span></h1>
          <p>Bring daily tasks, meaningful projects, and long-term ambitions into one calm, private planner.</p>
          <div className="hero-actions"><Link className="button button-primary button-large" to="/auth">Start planning free <Icon>arrow_forward</Icon></Link><a className="button button-soft button-large" href="#features"><Icon>play_circle</Icon> Explore Planify</a></div>
          <div className="preview-window">
            <div className="preview-top"><div className="window-dots"><i /><i /><i /></div><span>Today at a glance</span><span className="privacy-chip"><Icon>lock</Icon> Private by design</span></div>
            <div className="preview-content">
              <div className="preview-card">
                <div className="card-title-row"><div><small>THURSDAY, OCTOBER 24</small><h3>Today's focus</h3></div><span className="soft-chip">3 of 4 done</span></div>
                <div className="preview-task is-done"><span className="checkmark">✓</span><span>Morning stillness &amp; journaling</span></div>
                <div className="preview-task is-done"><span className="checkmark">✓</span><span>Review the product roadmap</span></div>
                <div className="preview-task"><span className="empty-check" /><span>Draft the launch checklist</span></div>
                <div className="momentum"><div><span>Daily momentum</span><b>76%</b></div><Progress value={76} /></div>
              </div>
              <div className="preview-card roadmap-preview">
                <div className="card-title-row"><div><small>YOUR BIG PICTURE</small><h3>Strategic horizons</h3></div><Icon>more_horiz</Icon></div>
                {[['Product launch', 82, 'primary'], ['Build a reading habit', 56, 'purple'], ['Half marathon', 37, 'blue']].map(([label, amount, color]) => <div className="roadmap-row" key={label}><div><span>{label}</span><b>{amount}%</b></div><Progress value={amount} /><span className={`roadmap-dot ${color}`} /></div>)}
                <div className="preview-foot"><Icon>auto_awesome</Icon> Make steady progress, without the noise.</div>
              </div>
            </div>
          </div>
        </section>
        <section className="feature-section" id="features">
          <div className="section-heading"><span className="eyebrow">Made for intentional days</span><h2>Less noise. More meaningful progress.</h2><p>A thoughtful workspace for the things you want to make time for.</p></div>
          <div className="feature-grid">
            <Feature icon="checklist_rtl" title="Daily focus" text="Keep the next right task visible and celebrate the progress you make." />
            <Feature icon="account_tree" title="Plans that connect" text="Break ambitious projects into clear, manageable steps." />
            <Feature icon="lock" title="Your private space" text="Keep personal plans behind a dedicated PIN-protected vault." />
          </div>
        </section>
        <section className="privacy-banner" id="privacy"><div className="privacy-icon"><Icon>shield_lock</Icon></div><div><span className="eyebrow">Privacy matters</span><h2>A planner that respects your space.</h2><p>Private Plans are separated from your everyday workspace and protected by your vault PIN.</p></div><Link className="button button-soft" to="/auth">Create your space <Icon>arrow_forward</Icon></Link></section>
      </main>
      <footer className="landing-footer"><Link className="brand" to="/"><span className="brand-mark"><Icon>checklist</Icon></span><span>Planify</span></Link><span>Make room for what matters.</span></footer>
    </div>
  )
}

function Feature({ icon, title, text }) {
  return <article className="feature-card"><div className="feature-icon"><Icon>{icon}</Icon></div><h3>{title}</h3><p>{text}</p></article>
}

function Auth() {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState(1)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const sendCode = async event => {
    event.preventDefault()
    setError('')
    if (!supabaseConfigured) return setError('Supabase is not configured. Copy client/.env.example to client/.env and add your project URL and anon key.')
    if (pin && !/^\d{4}$/.test(pin)) return setError('Your vault PIN must be exactly four digits.')
    setBusy(true)
    const { error: authError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    setBusy(false)
    if (authError) setError(authError.message)
    else setStep(2)
  }
  const verifyCode = async event => {
    event.preventDefault()
    setError('')
    if (!supabaseConfigured) return setError('Supabase is not configured. Copy client/.env.example to client/.env and add your project URL and anon key.')
    setBusy(true)
    const { error: authError } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
    if (authError) {
      setBusy(false)
      setError('That code is invalid or expired. Please try again.')
      return
    }
    if (pin) {
      try {
        await api('/pin', { method: 'POST', body: { pin } })
      } catch (reason) {
        if (!String(reason.message).toLowerCase().includes('déjà défini')) {
          setBusy(false)
          setError(reason.message || 'Could not set your vault PIN.')
          return
        }
      }
    }
    setBusy(false)
    navigate('/app')
  }
  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-card">
          <Link className="brand" to="/"><span className="brand-mark"><Icon>checklist</Icon></span><span>Planify</span></Link>
          <div className="auth-copy"><span className="eyebrow">{step === 1 ? 'A calmer way to plan' : 'One last step'}</span><h1>{step === 1 ? 'Make space for your goals.' : 'Check your inbox.'}</h1><p>{step === 1 ? 'Sign in or create your account with a one-time email code.' : `Enter the verification code sent to ${email}.`}</p></div>
          {step === 1 ? <form className="form-stack" onSubmit={sendCode}>
            <label>Email address<input autoComplete="email" type="email" required placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} /></label>
            <label>Vault PIN <span className="label-optional">Optional for first-time setup</span><input inputMode="numeric" autoComplete="new-password" maxLength={4} placeholder="4 digits" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} /></label>
            <p className="form-hint"><Icon>lock</Icon> The PIN protects your Private Plans vault.</p>
            <ErrorNotice message={error} />
            <Button className="button-full" disabled={busy}>{busy ? 'Sending code…' : 'Continue with email'} <Icon>arrow_forward</Icon></Button>
          </form> : <form className="form-stack" onSubmit={verifyCode}>
            <label>Verification code<input autoFocus inputMode="numeric" autoComplete="one-time-code" placeholder="Enter your code" value={code} onChange={event => setCode(event.target.value.replace(/\s/g, ''))} /></label>
            <ErrorNotice message={error} />
            <Button className="button-full" disabled={busy}>{busy ? 'Verifying…' : 'Verify and open Planify'} <Icon>lock_open</Icon></Button>
            <button type="button" className="text-button centered" onClick={() => setStep(1)}>Use a different email</button>
          </form>}
          <div className="auth-trust"><Icon>verified_user</Icon><span>Your plans stay yours. Private plans are PIN-protected.</span></div>
        </section>
        <aside className="auth-aside"><div className="aside-orb"><Icon>track_changes</Icon></div><span className="eyebrow">Small steps, real momentum</span><h2>Turn the big picture into a plan for today.</h2><p>Keep your goals close, your priorities clear, and your progress in view.</p><div className="aside-stat"><span className="aside-stat-icon"><Icon>auto_awesome</Icon></span><div><b>A little clarity goes a long way</b><span>Start with one thing that matters.</span></div></div></aside>
      </div>
    </main>
  )
}

const navItems = [
  { to: '/app', icon: 'grid_view', label: 'Home', end: true },
  { to: '/planning', icon: 'account_tree', label: 'Planning' },
  { to: '/private-plans', icon: 'lock', label: 'Private Plans', badge: 'PIN' },
  { to: '/assistant', icon: 'smart_toy', label: 'AI Assistant' },
  { to: '/settings', icon: 'settings', label: 'Settings' }
]

function Shell() {
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const signOut = async () => {
    sessionStorage.removeItem('pinToken')
    if (supabase) await supabase.auth.signOut()
    navigate('/')
  }
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div><Link className="brand sidebar-brand" to="/app"><span className="brand-mark"><Icon>checklist</Icon></span><span>Planify</span></Link>
        <nav className="side-nav">{navItems.map(item => <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMobileOpen(false)} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><Icon>{item.icon}</Icon><span>{item.label}</span>{item.badge && <small>{item.badge}</small>}</NavLink>)}</nav>
      </div>
      <div className="sidebar-bottom"><div className="vault-summary"><div className="summary-title"><span>Private space</span><Icon>lock</Icon></div><p>Your personal plans stay protected.</p><NavLink to="/private-plans">Open vault <Icon>arrow_forward</Icon></NavLink></div>
        <button className="profile-button" onClick={signOut}><span className="avatar">{(supabase.auth.getSession ? 'P' : 'P')}</span><span><b>Your account</b><small>Sign out</small></span><Icon>logout</Icon></button>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar"><button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setMobileOpen(!mobileOpen)}><Icon>{mobileOpen ? 'close' : 'menu'}</Icon></button><div className="searchbox"><Icon>search</Icon><input aria-label="Search" placeholder="Search goals, projects, notes…" onKeyDown={event => { if (event.key === 'Enter' && event.currentTarget.value) navigate(`/planning?search=${encodeURIComponent(event.currentTarget.value)}`) }} /><kbd>⌘ K</kbd></div><div className="topbar-right"><span className="today-pill"><Icon>calendar_today</Icon>{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span><Link className="button button-primary top-new" to="/planning"><Icon>add</Icon><span>New plan</span></Link></div></header>
      <main className="page-content"><Outlet /></main>
    </div>
  </div>
}

function PageTitle({ eyebrow, title, description, action }) {
  return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

function Home() {
  const { items, add, update, remove, error, loading, clearError } = useItems()
  const [taskTitle, setTaskTitle] = useState('')
  const [filter, setFilter] = useState('All')
  const [taskError, setTaskError] = useState('')
  const roots = items.filter(item => !item.parent_id)
  const tasks = roots.filter(item => item.kind === 'task')
  const openTasks = tasks.filter(item => !item.done)
  const projects = roots.filter(item => item.kind === 'project')
  const goals = roots.filter(item => item.kind === 'goal')
  const shownTasks = filter === 'Completed' ? tasks.filter(item => item.done) : filter === 'Open' ? openTasks : tasks
  const createTask = async event => {
    event.preventDefault()
    if (!taskTitle.trim()) return
    await add({ title: taskTitle.trim(), kind: 'task' })
    setTaskTitle('')
  }
  return <div className="page-stack">
    <PageTitle eyebrow="Your daily grounding" title={`Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}.`} description="A clear plan makes room for meaningful progress." action={<div className="date-note"><Icon>wb_twilight</Icon> Take it one step at a time</div>} />
    <ErrorNotice message={error || taskError} onClose={() => { clearError(); setTaskError('') }} />
    <div className="stats-grid"><Stat icon="task_alt" value={openTasks.length} label="Tasks to focus on" /><Stat icon="flag" value={projects.length + goals.length} label="Active plans" tone="purple" /><Stat icon="bolt" value={tasks.length ? `${Math.round((tasks.filter(item => item.done).length / tasks.length) * 100)}%` : '—'} label="Today's momentum" tone="blue" /></div>
    <div className="dashboard-grid">
      <section className="panel focus-panel"><div className="panel-heading"><div><span className="eyebrow">Make today count</span><h2>Today's focus</h2></div><Button variant="soft" onClick={() => document.getElementById('task-input')?.focus()}><Icon>add</Icon> Add task</Button></div>
        <div className="filter-tabs">{['All', 'Open', 'Completed'].map(name => <button key={name} className={filter === name ? 'selected' : ''} onClick={() => setFilter(name)}>{name}{name === 'All' ? ` (${tasks.length})` : ''}</button>)}</div>
        <form className="add-row" onSubmit={createTask}><input id="task-input" aria-label="New task" placeholder="Add a task you want to move forward…" value={taskTitle} onChange={event => setTaskTitle(event.target.value)} /><Button aria-label="Add task"><Icon>add</Icon></Button></form>
        {loading ? <p className="empty-state">Loading your tasks…</p> : shownTasks.length ? <div className="task-list">{shownTasks.map(item => <div className={`task-row ${item.done ? 'task-complete' : ''}`} key={item.id}><label className="task-check"><input type="checkbox" checked={item.done} onChange={event => update(item.id, { done: event.target.checked })} /><span><Icon>check</Icon></span></label><span className="task-name">{item.title}</span><span className="task-tag">{item.kind === 'task' ? 'Focus' : item.kind}</span><button className="icon-button delete-button" aria-label={`Delete ${item.title}`} onClick={() => remove(item.id)}><Icon>close</Icon></button></div>)}</div> : <EmptyState icon="coffee" title={filter === 'Completed' ? 'Nothing completed yet' : 'A little room to breathe'} text={filter === 'Completed' ? 'Finished tasks will show up here.' : 'Add a task above when you are ready.'} />}
      </section>
      <section className="panel overview-panel"><div className="panel-heading"><div><span className="eyebrow">The bigger picture</span><h2>Active plans</h2></div><Link className="text-button" to="/planning">View all <Icon>arrow_forward</Icon></Link></div>
        {projects.length || goals.length ? <div className="overview-list">{[...projects, ...goals].slice(0, 4).map(item => { const progress = progressOf(items, item); return <div className="overview-item" key={item.id}><div className="overview-icon"><Icon>{item.kind === 'goal' ? 'flag' : 'folder'}</Icon></div><div className="overview-detail"><div><b>{item.title}</b><span>{progress}%</span></div><Progress value={progress} /></div></div> })}</div> : <EmptyState icon="account_tree" title="Your roadmap starts here" text="Create a project or a goal to see your progress take shape." />}
        <Link to="/planning" className="subtle-link"><Icon>add</Icon> Create a plan</Link>
      </section>
    </div>
    <section className="horizon-banner"><div className="horizon-orb"><Icon>auto_awesome</Icon></div><div><span className="eyebrow">A gentle reminder</span><h2>Progress is built one thoughtful step at a time.</h2><p>Your long-term goals are made of the small things you do today.</p></div><Link to="/assistant" className="button button-soft">Plan with AI <Icon>arrow_forward</Icon></Link></section>
  </div>
}

function Stat({ icon, value, label, tone = '' }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon>{icon}</Icon></div><div><b>{value}</b><span>{label}</span></div></div>
}

function EmptyState({ icon, title, text }) {
  return <div className="empty-state"><div><Icon>{icon}</Icon></div><b>{title}</b><span>{text}</span></div>
}

function PlannerNode({ item, items, actions, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 1)
  const [childTitle, setChildTitle] = useState('')
  const children = childrenOf(items, item.id)
  const progress = progressOf(items, item)
  const addChild = async event => {
    event.preventDefault()
    if (!childTitle.trim()) return
    await actions.add({ title: childTitle.trim(), kind: 'task', parent_id: item.id })
    setChildTitle('')
    setExpanded(true)
  }
  return <div className={`tree-node depth-${Math.min(depth, 3)}`}>
    <div className="tree-node-row"><button className="tree-toggle" aria-label={expanded ? 'Collapse' : 'Expand'} onClick={() => setExpanded(!expanded)}><Icon>{expanded ? 'keyboard_arrow_down' : 'chevron_right'}</Icon></button><span className={`tree-kind ${item.kind}`}><Icon>{item.kind === 'goal' ? 'flag' : item.kind === 'project' ? 'folder' : item.done ? 'task_alt' : 'radio_button_unchecked'}</Icon></span><span className={`tree-name ${item.done ? 'done' : ''}`}>{item.title}</span><span className="tree-percent">{progress}%</span><button className="icon-button delete-button" aria-label={`Delete ${item.title}`} onClick={() => actions.remove(item.id)}><Icon>more_horiz</Icon></button></div>
    <div className="tree-progress"><Progress value={progress} /></div>
    {expanded && <div className="tree-children">
      {children.map(child => <PlannerNode key={child.id} item={child} items={items} actions={actions} depth={depth + 1} />)}
      <form className="child-add" onSubmit={addChild}><Icon>add</Icon><input aria-label={`Add step to ${item.title}`} placeholder="Add a step or milestone…" value={childTitle} onChange={event => setChildTitle(event.target.value)} /></form>
    </div>}
  </div>
}

function Planning() {
  const actions = useItems(false)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('project')
  const [filter, setFilter] = useState('')
  const [status, setStatus] = useState('All')
  const roots = useMemo(() => actions.items.filter(item => !item.parent_id && item.kind !== 'task'), [actions.items])
  const visible = roots.filter(item => {
    const matchesText = item.title.toLowerCase().includes(filter.toLowerCase())
    const percent = progressOf(actions.items, item)
    return matchesText && (status === 'All' || (status === 'In progress' && percent > 0 && percent < 100) || (status === 'Planning' && percent === 0) || (status === 'Completed' && percent === 100))
  })
  const create = async event => {
    event.preventDefault()
    if (!title.trim()) return
    await actions.add({ title: title.trim(), kind })
    setTitle('')
  }
  return <div className="page-stack">
    <PageTitle eyebrow="Your roadmap" title="Planning & projects" description="Give your big ideas a structure, then take them one step at a time." action={<span className="page-token"><Icon>account_tree</Icon> Your workspace</span>} />
    <ErrorNotice message={actions.error} onClose={actions.clearError} />
    <section className="panel planning-panel">
      <div className="planner-toolbar"><div className="planner-filters"><label className="search-filter"><Icon>search</Icon><input aria-label="Filter plans" placeholder="Find a plan…" value={filter} onChange={event => setFilter(event.target.value)} /></label><div className="filter-tabs">{['All', 'In progress', 'Planning', 'Completed'].map(value => <button key={value} className={status === value ? 'selected' : ''} onClick={() => setStatus(value)}>{value}</button>)}</div></div>
        <form className="create-plan-form" onSubmit={create}><select aria-label="Plan type" value={kind} onChange={event => setKind(event.target.value)}><option value="project">Project</option><option value="goal">Goal</option></select><input aria-label="Plan name" placeholder="Name your next plan…" value={title} onChange={event => setTitle(event.target.value)} /><Button><Icon>add</Icon> Create plan</Button></form>
      </div>
      <div className="planning-layout"><div className="plan-list-column"><div className="panel-subheading"><div><Icon>account_tree</Icon><b>Your plans</b></div><span>{roots.length} plans</span></div>
        {actions.loading ? <p className="empty-state">Loading your plans…</p> : visible.length ? <div className="tree-list">{visible.map(item => <PlannerNode key={item.id} item={item} items={actions.items} actions={actions} />)}</div> : <EmptyState icon="folder_open" title={filter ? 'No matching plans' : 'A blank page, full of potential'} text={filter ? 'Try another search or filter.' : 'Create your first project or goal above.'} />}
      </div><aside className="planning-aside"><div className="aside-card"><div className="feature-icon"><Icon>lightbulb</Icon></div><span className="eyebrow">A useful way to start</span><h3>Make the next step small.</h3><p>Open any plan and add steps underneath it. Small milestones make your progress easier to see.</p></div><div className="aside-metric"><span className="metric-ring"><Icon>track_changes</Icon></span><div><b>{actions.items.length}</b><span>items in your workspace</span></div></div></aside></div>
    </section>
  </div>
}

function PinGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => !!sessionStorage.getItem('pinToken'))
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const unlock = async event => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { token } = await api('/pin/verify', { method: 'POST', body: { pin } })
      sessionStorage.setItem('pinToken', token)
      setUnlocked(true)
    } catch (reason) {
      setError(reason.message || 'PIN verification failed.')
      setPin('')
    } finally {
      setBusy(false)
    }
  }
  if (unlocked) return children
  return <div className="vault-page"><div className="vault-blur" aria-hidden="true"><div /><div /><div /></div><form className="vault-card" onSubmit={unlock}><div className="vault-lock"><Icon>lock</Icon></div><span className="eyebrow">A little extra privacy</span><h1>Private Plans</h1><p>Enter your 4-digit vault PIN to open your private planning space.</p><div className="pin-dots" aria-hidden="true">{[0, 1, 2, 3].map(index => <span className={index < pin.length ? 'filled' : ''} key={index} />)}</div><input className="pin-input" aria-label="Four digit PIN" autoFocus autoComplete="current-password" inputMode="numeric" maxLength={4} type="password" placeholder="Enter PIN" value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ''))} /><ErrorNotice message={error} /><Button className="button-full" disabled={busy || pin.length !== 4}>{busy ? 'Unlocking…' : 'Unlock vault'} <Icon>arrow_forward</Icon></Button><div className="vault-assurance"><Icon>verified_user</Icon><span>Only you can open this space with your PIN.</span></div></form></div>
}

function PrivatePlanner() {
  const actions = useItems(true)
  const [title, setTitle] = useState('')
  const create = async event => {
    event.preventDefault()
    if (!title.trim()) return
    await actions.add({ title: title.trim(), kind: 'project' })
    setTitle('')
  }
  return <div className="page-stack"><PageTitle eyebrow="Your personal space" title="Private Plans" description="A quiet, PIN-protected space for plans that are just for you." action={<span className="privacy-chip"><Icon>lock</Icon> Vault unlocked</span>} /><ErrorNotice message={actions.error} onClose={actions.clearError} />
    <section className="private-intro"><div className="private-lock"><Icon>shield_lock</Icon></div><div><span className="eyebrow">Just for you</span><h2>Your private space is open.</h2><p>These plans are kept separate from your regular workspace.</p></div><button className="text-button" onClick={() => { sessionStorage.removeItem('pinToken'); location.reload() }}>Lock vault <Icon>lock</Icon></button></section>
    <section className="panel"><div className="panel-heading"><div><span className="eyebrow">Keep it personal</span><h2>Your private plans</h2></div></div><form className="create-plan-form private-create" onSubmit={create}><input aria-label="Private plan name" placeholder="Add a private plan…" value={title} onChange={event => setTitle(event.target.value)} /><Button><Icon>add</Icon> Add plan</Button></form>{actions.loading ? <p className="empty-state">Loading your private plans…</p> : actions.items.filter(item => !item.parent_id).length ? <div className="tree-list">{actions.items.filter(item => !item.parent_id).map(item => <PlannerNode key={item.id} item={item} items={actions.items} actions={actions} />)}</div> : <EmptyState icon="lock" title="Your vault is ready" text="Add a private plan above. It will only appear in this protected space." />}</section>
  </div>
}

function Assistant() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hi! I can help you break a goal into manageable steps or make a plan for your week. What would you like to work on?' }])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const send = async value => {
    const content = value.trim()
    if (!content || busy) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setText('')
    setError('')
    setBusy(true)
    try {
      const { reply } = await api('/chat', { method: 'POST', body: { messages: next } })
      setMessages([...next, { role: 'assistant', content: reply }])
    } catch (reason) {
      setError(reason.message || 'The assistant could not respond. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return <div className="page-stack assistant-page"><PageTitle eyebrow="Your planning partner" title="Planify AI Copilot" description="A helpful partner for turning intentions into realistic next steps." action={<span className="online-chip"><i /> Ready when you are</span>} />
    <ErrorNotice message={error} onClose={() => setError('')} />
    <div className="assistant-layout"><section className="panel chat-panel"><div className="chat-heading"><div className="assistant-avatar"><Icon>smart_toy</Icon></div><div><b>Planify Copilot</b><span>Practical, thoughtful planning help</span></div><button className="text-button" onClick={() => { setMessages([]); setError('') }}>New chat <Icon>add</Icon></button></div>
      <div className="chat-stream">{messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}><div className="message-avatar"><Icon>{message.role === 'assistant' ? 'auto_awesome' : 'person'}</Icon></div><div className="message-body"><span>{message.role === 'assistant' ? 'Planify Copilot' : 'You'}</span><p>{message.content}</p></div></div>)}{busy && <div className="chat-message assistant"><div className="message-avatar"><Icon>auto_awesome</Icon></div><div className="message-body"><span>Planify Copilot</span><p className="thinking"><i /><i /><i /></p></div></div>}</div>
      <div className="suggestions"><span><Icon>auto_awesome</Icon> Try asking</span><div>{['Help me plan my week', 'Break a goal into steps', 'What should I focus on today?'].map(suggestion => <button key={suggestion} onClick={() => send(suggestion)}>{suggestion}</button>)}</div></div>
      <form className="chat-composer" onSubmit={event => { event.preventDefault(); send(text) }}><input aria-label="Message to Planify Copilot" placeholder="Ask Planify to help plan or organize…" value={text} onChange={event => setText(event.target.value)} /><Button aria-label="Send message" disabled={busy || !text.trim()}><Icon>arrow_upward</Icon></Button></form>
    </section><aside className="assistant-side"><section className="panel"><span className="eyebrow">What we can work on</span><h2>From big idea to next step.</h2><div className="capability"><div><Icon>splitscreen</Icon></div><span><b>Break down a goal</b><small>Turn a big outcome into small milestones.</small></span></div><div className="capability"><div><Icon>calendar_clock</Icon></div><span><b>Plan your week</b><small>Shape a realistic schedule around priorities.</small></span></div><div className="capability"><div><Icon>psychology</Icon></div><span><b>Reflect and reset</b><small>Make sense of what is working for you.</small></span></div><p className="privacy-reminder"><Icon>shield</Icon> Private plans are not shared with the assistant.</p></section></aside></div>
  </div>
}

function Settings() {
  const [email, setEmail] = useState('')
  const [currentPin, setCurrentPin] = useState('')
  const [nextPin, setNextPin] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [prefs, setPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('planifyPreferences') || '{"briefing":true,"weekly":true,"dark":false}') }
    catch { return { briefing: true, weekly: true, dark: false } }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', prefs.dark)
  }, [prefs.dark])
  const saveEmail = async event => {
    event.preventDefault()
    setError(''); setNotice('')
    if (!supabaseConfigured) return setError('Supabase is not configured. Add your project URL and anon key to client/.env.')
    const { error: updateError } = await supabase.auth.updateUser({ email })
    if (updateError) setError(updateError.message)
    else setNotice('A confirmation link has been sent to your new email address.')
  }
  const savePin = async event => {
    event.preventDefault()
    setError(''); setNotice('')
    try {
      await api('/pin', { method: 'PUT', body: { oldPin: currentPin, newPin: nextPin } })
      setNotice('Your vault PIN has been updated.')
      setCurrentPin(''); setNextPin('')
    } catch (reason) { setError(reason.message || 'Could not update your PIN.') }
  }
  const togglePreference = key => setPrefs(previous => {
    const next = { ...previous, [key]: !previous[key] }
    localStorage.setItem('planifyPreferences', JSON.stringify(next))
    return next
  })
  return <div className="page-stack"><PageTitle eyebrow="Configuration & privacy" title="Account & security" description="Manage your account details, vault access, and preferences." action={<span className="online-chip"><i /> Your account is protected</span>} />
    <ErrorNotice message={error} onClose={() => setError('')} />{notice && <div className="notice notice-success">{notice}<button onClick={() => setNotice('')}>×</button></div>}
    <div className="settings-layout"><aside className="settings-nav"><span>ON THIS PAGE</span><a href="#identity"><Icon>badge</Icon> Profile &amp; identity</a><a href="#security"><Icon>security</Icon> Security &amp; vault</a><a href="#preferences"><Icon>tune</Icon> Preferences</a><div className="settings-tip"><Icon>shield_lock</Icon><b>Your privacy comes first</b><p>Your vault PIN is used only to unlock your private plans.</p></div></aside>
      <div className="settings-content">
        <section className="panel settings-section" id="identity"><div className="panel-heading"><div><h2>Profile &amp; identity</h2><p>Update the email address linked to your Planify account.</p></div><span className="section-badge">Account</span></div><div className="profile-card"><div className="avatar avatar-large">P</div><div><b>Planify member</b><span>Your personal planning workspace</span></div><Icon>verified_user</Icon></div><form className="settings-form" onSubmit={saveEmail}><label>New email address<input type="email" required placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} /></label><Button variant="soft"><Icon>mail</Icon> Update email</Button></form></section>
        <section className="settings-section" id="security"><div className="section-title"><span className="eyebrow">Stay in control</span><h2>Security &amp; credentials</h2><p>Keep your login and private vault access up to date.</p></div><div className="panel pin-settings"><div className="settings-card-icon"><Icon>lock_clock</Icon></div><div className="pin-settings-copy"><h3>Change vault PIN</h3><p>Your four-digit PIN is required to open Private Plans.</p><form className="settings-form pin-form" onSubmit={savePin}><label>Current PIN<input type="password" inputMode="numeric" maxLength={4} required placeholder="••••" value={currentPin} onChange={event => setCurrentPin(event.target.value.replace(/\D/g, ''))} /></label><label>New PIN<input type="password" inputMode="numeric" maxLength={4} required placeholder="4 digits" value={nextPin} onChange={event => setNextPin(event.target.value.replace(/\D/g, ''))} /></label><Button disabled={currentPin.length !== 4 || nextPin.length !== 4}><Icon>verified_user</Icon> Update PIN</Button></form></div></div></section>
        <section className="panel settings-section" id="preferences"><div className="panel-heading"><div><h2>Preferences</h2><p>Choose what feels right for your planning routine.</p></div><Icon className="heading-icon">tune</Icon></div><Preference title="Daily morning briefing" description="A gentle summary of your goals and priorities." checked={prefs.briefing} onChange={() => togglePreference('briefing')} /><Preference title="End-of-week reflection" description="A weekly moment to notice your progress and reset." checked={prefs.weekly} onChange={() => togglePreference('weekly')} /><Preference title="Dark mode" description="Use a darker appearance for your workspace." checked={prefs.dark} onChange={() => togglePreference('dark')} /></section>
        <section className="panel settings-section logout-section"><div><h2>Sign out</h2><p>End this session on this device.</p></div><Button variant="danger" onClick={async () => { sessionStorage.removeItem('pinToken'); if (supabase) await supabase.auth.signOut() }}><Icon>logout</Icon> Sign out</Button></section>
      </div>
    </div>
  </div>
}

function Preference({ title, description, checked, onChange }) {
  return <label className="preference-row"><span><b>{title}</b><small>{description}</small></span><input type="checkbox" checked={checked} onChange={onChange} /><i /></label>
}

function Guard({ session }) {
  if (session === undefined) return <div className="app-loading"><span className="brand-mark"><Icon>checklist</Icon></span><p>Opening your workspace…</p></div>
  return session ? <Shell /> : <Navigate to="/auth" />
}

export default function App() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    if (!supabase) {
      setSession(null)
      return undefined
    }
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Could not restore the Supabase session:', error.message)
      setSession(data?.session || null)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])
  return <BrowserRouter><Routes><Route path="/" element={<Landing />} /><Route path="/auth" element={<Auth />} /><Route element={<Guard session={session} />}><Route path="/app" element={<Home />} /><Route path="/planning" element={<Planning />} /><Route path="/private-plans" element={<PinGate><PrivatePlanner /></PinGate>} /><Route path="/PL" element={<Navigate to="/private-plans" replace />} /><Route path="/assistant" element={<Assistant />} /><Route path="/settings" element={<Settings />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter>
}
