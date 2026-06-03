# CCEA Maker Clubs — Debug Guide

## Quick Reference

| Symptom | Likely Cause | Fix |
|---|---|---|
| White screen, no errors in terminal | Supabase `createClient` crash at module scope | Add `.env` with valid credentials, or check `src/lib/supabase.js` |
| White screen, import error in console | Missing CSS import | Ensure `App.jsx` imports `./App.css` |
| App loads but no data | Missing/invalid Supabase env vars | Create `.env` file (see below) |
| "Invalid supabaseUrl" in console | `.env` not created or vars empty | See Environment Setup |
| Spinner stuck forever | `AuthContext` waiting for Supabase response | 5s timeout should clear it — check console for network errors |
| Styles look wrong after pull | CSS file not saved or cached | Hard refresh (`Ctrl+Shift+R`), restart dev server |
| Port 5173 in use | Another dev server instance running | Kill it or Vite auto-picks next port |

---

## Environment Setup

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Where to find these:**
1. Go to [supabase.com](https://supabase.com) → your project
2. Settings → API → Project URL = `VITE_SUPABASE_URL`
3. Settings → API → `anon` `public` key = `VITE_SUPABASE_ANON_KEY`

The app includes a fallback stub when these are missing — it won't crash, but all data features will be non-functional. You'll see a console warning:
```
⚠️ Supabase initialization failed: Missing Supabase environment variables
```

---

## Architecture

```
src/
├── main.jsx              # Entry — wraps App in ThemeProvider + AuthProvider
├── App.jsx               # Router + layout shell (Navbar, routes, background)
├── App.css               # Component-level styles (navbar, hero, cards, etc.)
├── index.css             # Design tokens + base styles (buttons, forms, badges)
├── contexts/
│   ├── AuthContext.jsx   # Auth state, session management, profile fetch
│   └── ThemeContext.jsx  # Dark/light mode toggle, persisted to localStorage
├── components/
│   ├── Navbar.jsx
│   ├── ParticleBackground.jsx  # Subtle dot-grid background
│   ├── AnimatedPage.jsx        # Framer-motion page wrapper
│   ├── AnimatedCounter.jsx     # Animated stat numbers
│   ├── ProtectedRoute.jsx      # Auth guard with role checking
│   └── dashboards/
│       ├── StudentDashboard.jsx
│       ├── FacultyDashboard.jsx
│       └── SuperAdminDashboard.jsx
├── pages/
│   ├── HomePage.jsx       # Landing — hero, stats, upcoming events
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── ForgotPassword.jsx
│   ├── UpdatePassword.jsx
│   ├── Dashboard.jsx      # Role-based dashboard switcher
│   ├── CreateChapter.jsx
│   ├── HostEvent.jsx      # Create/edit events
│   ├── EventDetail.jsx
│   ├── ManageEvent.jsx
│   ├── ClubDetail.jsx
│   └── Profile.jsx
└── lib/
    ├── supabase.js        # Supabase client init (with fallback stub)
    ├── eventUtils.js      # isEventOver() helper
    └── pdfUtils.js        # PDF generation utilities
```

---

## Data Flow

```
User opens app
  → main.jsx renders ThemeProvider → AuthProvider → App
  → AuthProvider calls supabase.auth.getSession()
    → If session exists: fetch profile from `profiles` table
    → If no session: render app as guest
    → 5-second timeout ensures app renders even if Supabase is unreachable
  → App renders Router with Navbar + AnimatedRoutes
  → ProtectedRoute checks user + profile.role before rendering guarded pages
```

### Roles

| Role | Access |
|---|---|
| `student` | Join clubs, register for events, view dashboard |
| `faculty` | Manage assigned clubs, view all campus clubs |
| `super_admin` | Approve/reject club chapters |

---

## Common Development Issues

### 1. White Screen

The most common cause is a crash in `src/lib/supabase.js`. The Supabase `createClient()` function **throws** if the URL isn't a valid HTTP/HTTPS URL. Since this runs at module scope (not inside a React component), the crash kills the entire module graph before React mounts.

**Current fix:** `supabase.js` wraps `createClient` in try/catch and provides a no-op stub client. The app renders with empty data instead of crashing.

### 2. CSS Not Loading

`App.css` contains all page-specific styles but must be explicitly imported in `App.jsx`:
```js
import './App.css';
```
If this line is missing, the HTML renders but everything is unstyled.

### 3. Auth Stuck on Loading

`AuthContext` shows a loading spinner until Supabase responds. A 5-second timeout (`setTimeout`) ensures the app eventually renders even if:
- Supabase is unreachable
- Network is slow
- Env vars are invalid

Check the browser console for Supabase errors if loading persists.

### 4. Build Warnings

Vite may warn about large chunks (>500KB). This is due to bundling `html2canvas` and `jspdf`. Not a functional issue. To fix, add code splitting:

```js
// Lazy import heavy libs only where used
const jsPDF = await import('jspdf');
```

---

## Database Schema

Key tables (defined in `init.sql`):

| Table | Purpose |
|---|---|
| `profiles` | User profiles (linked to Supabase auth) |
| `club_chapters` | Club definitions (name, description, status, lead) |
| `club_members` | Membership records (user ↔ chapter, role, status) |
| `events` | Event definitions (date, venue, type, chapter) |
| `event_registrations` | User ↔ event registration records |

---

## Commands

```bash
npm run dev      # Start dev server (Vite)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

---

## Design System

The app uses a **neo-brutalist** design language:

- **Borders:** Thick, solid (`2.5px solid`)
- **Shadows:** Hard offset, no blur (`4px 4px 0px`)
- **Colors:** Vivid, flat (red, yellow, green)
- **Typography:** Space Grotesk (display), JetBrains Mono (labels/badges)
- **Radius:** Small and consistent (`8px` / `12px`)
- **No glassmorphism:** No backdrop-filter, no transparency

All design tokens live in CSS custom properties in `index.css`. Changing tokens automatically reskins every component.
