# 🌐 Emble Web Dashboard & API (MEP4 Room 744)

Responsive Web Dashboard and PWA for **MEP4 Room 744** classroom homework tracking, timetable viewing, announcements, analytics, and admin management.

Designed to be hosted **100% serverlessly on Vercel**.

---

## 🛠️ Tech Stack

- **Frontend SPA**: React 18 (`^18.3.1`), TypeScript (`^5.5.3`), Vite (`^5.3.4`), React Router DOM (`^6.23.1`)
- **Backend API**: Express v4 running as a Vercel Serverless Function (`api/index.js`)
- **Database**: Google Sheets API v4 via Service Account
- **Auth**: Discord OAuth2 + Student ID / Password credentials with PBKDF2 hashing
- **PWA**: Installable Web App with Service Worker (`public/` & `web/public/`)

---

## 🚀 Deploying to Vercel (1-Click)

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com): **New Project** → Select this repository.
3. Vercel automatically detects the build command (`npm run build:web`) and output directory (`web/dist`).
4. Under **Project Settings → Environment Variables**, add:
   - `GOOGLE_SHEET_ID`: Your Google Spreadsheet ID
   - `GOOGLE_CREDENTIALS`: Service Account JSON (single line)
   - `DISCORD_TOKEN`: Discord Bot token (for guild verification & permissions)
   - `CLIENT_ID`: Discord application client ID
   - `GUILD_ID`: Target Discord server ID
   - `DISCORD_CLIENT_SECRET`: Discord OAuth2 client secret
   - `DISCORD_REDIRECT_URI`: `https://your-vercel-domain.vercel.app/api/auth/discord/callback`
   - `APP_URL`: `https://your-vercel-domain.vercel.app`
   - `SESSION_SECRET`: Random 32+ character string
   - `ADMIN_ROLE_ID`: Discord Role ID or User ID for teacher/admin rights
5. Click **Deploy**!

---

## 💻 Local Development

1. Install root and frontend dependencies:
   ```bash
   npm install
   cd web && npm install && cd ..
   ```
2. Start the local backend API (port 3000):
   ```bash
   npm run dev
   ```
3. In a second terminal, start the Vite frontend (port 5173 with proxy to 3000):
   ```bash
   npm run dev:web
   ```
4. Build for production:
   ```bash
   npm run build
   ```
