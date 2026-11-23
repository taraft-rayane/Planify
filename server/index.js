import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { createClient } from '@supabase/supabase-js'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const app = express()
const clientUrl = process.env.CLIENT_URL
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || !clientUrl || origin === clientUrl) return callback(null, true)
    callback(null, false)
  }
}))
app.use(express.json())

const wrap = f => (req, res) => f(req, res).catch(e => res.status(500).json({ error: e.message }))
const sign = (uid, exp) => crypto.createHmac('sha256', process.env.PIN_SECRET).update(`${uid}.${exp}`).digest('hex')
const same = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))

// Authentification : vérifie le jeton Supabase
async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) return res.status(401).json({ error: 'Non autorisé' })
  req.user = data.user
  req.priv = req.query.private === 'true'
  if (req.priv) { // espace privé : jeton PIN obligatoire
    const [exp, sig] = (req.headers['x-pin-token'] || '.').split('.')
    if (!(Date.now() < +exp && same(sig || '', sign(req.user.id, exp)))) return res.status(403).json({ error: 'PIN requis' })
  }
  next()
}

// --- PIN ---
app.post('/api/pin', auth, wrap(async (req, res) => {
  const { pin } = req.body
  if (!/^\d{4}$/.test(pin || '')) return res.status(400).json({ error: 'PIN à 4 chiffres' })
  const { data } = await sb.from('profiles').select('pin_hash').eq('id', req.user.id).maybeSingle()
  if (data?.pin_hash) return res.status(409).json({ error: 'PIN déjà défini' })
  await sb.from('profiles').upsert({ id: req.user.id, pin_hash: await bcrypt.hash(pin, 10) })
  res.json({ ok: true })
}))
app.put('/api/pin', auth, wrap(async (req, res) => {
  const { oldPin, newPin } = req.body
  const { data } = await sb.from('profiles').select('pin_hash').eq('id', req.user.id).maybeSingle()
  if (!data?.pin_hash || !(await bcrypt.compare(oldPin || '', data.pin_hash))) return res.status(400).json({ error: 'Ancien PIN incorrect' })
  if (!/^\d{4}$/.test(newPin || '')) return res.status(400).json({ error: 'PIN à 4 chiffres' })
  await sb.from('profiles').update({ pin_hash: await bcrypt.hash(newPin, 10) }).eq('id', req.user.id)
  res.json({ ok: true })
}))
app.post('/api/pin/verify', auth, wrap(async (req, res) => {
  const { data } = await sb.from('profiles').select('pin_hash').eq('id', req.user.id).maybeSingle()
  if (!data?.pin_hash || !(await bcrypt.compare(req.body.pin || '', data.pin_hash))) return res.status(401).json({ error: 'PIN incorrect' })
  const exp = Date.now() + 30 * 60 * 1000 // valable 30 min
  res.json({ token: `${exp}.${sign(req.user.id, exp)}` })
}))

// --- Tâches / projets / objectifs (arborescence via parent_id) ---
app.get('/api/items', auth, wrap(async (req, res) => {
  const { data, error } = await sb.from('items').select('*').eq('user_id', req.user.id).eq('is_private', req.priv).order('created_at')
  if (error) throw error
  res.json(data)
}))
app.post('/api/items', auth, wrap(async (req, res) => {
  const { title, kind = 'task', parent_id = null, due_date = null } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'Titre requis' })
  const { data, error } = await sb.from('items').insert({ title, kind, parent_id, due_date, user_id: req.user.id, is_private: req.priv }).select().single()
  if (error) throw error
  res.json(data)
}))
app.patch('/api/items/:id', auth, wrap(async (req, res) => {
  const { title, notes, done, due_date } = req.body
  const patch = Object.fromEntries(Object.entries({ title, notes, done, due_date }).filter(([, v]) => v !== undefined))
  const { error } = await sb.from('items').update(patch).eq('id', req.params.id).eq('user_id', req.user.id).eq('is_private', req.priv)
  if (error) throw error
  res.json({ ok: true })
}))
app.delete('/api/items/:id', auth, wrap(async (req, res) => {
  const { error } = await sb.from('items').delete().eq('id', req.params.id).eq('user_id', req.user.id).eq('is_private', req.priv)
  if (error) throw error
  res.json({ ok: true })
}))

// --- Chatbot IA (ne voit jamais les plans privés) ---
app.post('/api/chat', auth, wrap(async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: 'Gemini is not configured. Add GEMINI_API_KEY to server/.env.' })
  const messages = req.body?.messages
  if (!Array.isArray(messages) || messages.length === 0 || messages.some(message =>
    !message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string'
  )) return res.status(400).json({ error: 'A non-empty list of user and assistant messages is required.' })

  const { data: items, error } = await sb.from('items').select('title,kind,done,due_date').eq('user_id', req.user.id).eq('is_private', false).limit(100)
  if (error) throw error
  const systemInstruction = `Tu es l'assistant de planification de Planify. Réponds en français, de façon concrète et brève. Tâches et objectifs actuels de l'utilisateur : ${JSON.stringify(items)}`
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: messages.map(message => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }]
      })),
      generationConfig: { maxOutputTokens: 1000 }
    })
  })
  const result = await response.json()
  if (!response.ok) return res.status(response.status).json({ error: result.error?.message || 'Gemini request failed.' })
  const reply = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim()
  if (!reply) return res.status(502).json({ error: 'Gemini returned no text. Try rephrasing your message.' })
  res.json({ reply })
}))

if (process.env.NODE_ENV === 'production') {
  const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), '../client/dist')
  app.use(express.static(clientDist))
  app.get('*', (req, res, next) => {
    if (req.path === '/api' || req.path.startsWith('/api/')) return next()
    res.sendFile(resolve(clientDist, 'index.html'))
  })
}

if (!process.env.VERCEL) {
  app.listen(process.env.PORT || 3001, () => console.log('API prête'))
}

export default app
