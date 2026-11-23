# Planify (React + Node.js + Supabase)

## 1. Create and configure a Supabase project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. In the project's SQL Editor, run `supabase/schema.sql`.
3. In **Project Settings > API**, copy the Project URL, the anon/public key, and the `service_role` key.
4. In **Authentication > Email Templates > Magic Link**, use `{{ .Token }}` as the email body if you want users to enter a one-time code in Planify.

Keep the `service_role` key private: it belongs only in `server/.env`. Never put it in the client or in a variable prefixed with `VITE_`.

## 2. Configure the backend

In PowerShell, from the project root:

```powershell
Copy-Item server\.env.example server\.env
```

Edit `server/.env` and set:

- `SUPABASE_URL`: the Project URL
- `SUPABASE_SERVICE_KEY`: the `service_role` key
- `PIN_SECRET`: a randomly generated secret (for example, run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `CLIENT_URL=http://localhost:5173`
- `PORT=3001`

For the AI Assistant, create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) and set `GEMINI_API_KEY` in `server/.env`. The default `GEMINI_MODEL=gemini-3.5-flash-lite` is listed as free of charge for input and output tokens on the Gemini API free tier. Free-tier usage has limits, and Google may use free-tier content to improve its products; see [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [terms](https://ai.google.dev/gemini-api/terms).

Install dependencies and start the API:

```powershell
Set-Location server
npm install
npm run dev
```

## 3. Configure and run the frontend

In a second PowerShell window, from the project root:

```powershell
Copy-Item client\.env.example client\.env
```

Edit `client/.env` and set `VITE_SUPABASE_URL` to the Project URL and `VITE_SUPABASE_ANON_KEY` to the anon/public key. Keep `VITE_API_URL=http://localhost:3001/api`.

Then run:

```powershell
Set-Location client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Restart the Vite dev server after changing `.env` files.
