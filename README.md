# CCEA Maker Clubs

A modern, neo-brutalist web application designed for campus clubs to manage chapters, coordinate events, track memberships, and automate attendance logging. Built with a robust React frontend, Vite build tool, and powered by Supabase.

---

## 🚀 Features

### 1. Neo-Brutalist Design Language
- **Distinct Visual Style:** Flat, vibrant color palette, thick solid borders (`2.5px solid`), and sharp hard-offset shadows (`4px 4px 0px`).
- **Interactive:** Particle backgrounds, responsive state transitions, and smooth page animations using `framer-motion`.
- **Theme Support:** Persisted dark/light mode toggle.

### 2. Multi-Role System
- **Students:** Browse campus clubs, register for upcoming events, view personal stats, and track their participation progress.
- **Faculty:** Manage assigned club chapters, review and approve member requests, and oversee event participation.
- **Super Admins:** Global administration portal to review and approve/reject new club chapter proposals.

### 3. Event & Attendance Management
- **Custom RSVP Forms:** Create events with dynamic fields to collect custom data from participants.
- **Flexible Attendance Tracking:**
  - Standard present/absent tracking.
  - Class-hour-specific attendance tracking for events hosted during academic hours.
- **Automated JSON Attendance Logging:** Upload a JSON file of attendees to auto-fill attendance status. Utilizes fuzzy name matching and avatar URL mapping (`src/assets/db.json`) for exact matching.
- **Exporting Data:**
  - Export registered student details and custom forms to **CSV**.
  - Generate formatted attendance sheets in **PDF** (using `jspdf` & `jspdf-autotable`).

---

## 🛠️ Tech Stack

- **Frontend Framework:** React (v19)
- **Build Tool:** Vite (v8)
- **Styling:** Neo-brutalist CSS custom properties
- **Database & Auth:** Supabase (PostgreSQL & GoTrue Auth)
- **Animations:** Framer Motion
- **Charts/Analytics:** Recharts
- **PDF Generation:** jsPDF & jsPDF-AutoTable
- **Icons:** Lucide React

---

## ⚙️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- A [Supabase](https://supabase.com) account & project

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/aswin7512/CCEA-Clubs
   cd CCEA-Clubs
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   *Note: If these variables are not provided, the app will run in offline stub mode with static demo data.*

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173/`.

5. **Build for Production:**
   ```bash
   npm run build
   ```

---

## 🗄️ Database Schema

The system integrates with a Supabase PostgreSQL backend containing the following key tables:

- **`profiles`**: Stores user metadata (names, departments, roll numbers, PRP codes, and roles).
- **`club_chapters`**: Registered club chapters, status (pending/approved), and assigned leads.
- **`club_members`**: Student membership status within specific club chapters.
- **`events`**: Event information, event type, class hours logs, and related chapter.
- **`event_registrations`**: Connects users to events, including custom question answers and attendance records (`attended_hours` and `is_present`).

---

## 📂 Project Structure

```
src/
├── main.jsx              # Entry point wrapping providers
├── App.jsx               # Navigation routes, layouts & global wrappers
├── App.css               # Page-specific stylesheet
├── index.css             # Base typography, neo-brutalist CSS design system variables
├── assets/
│   ├── db.json           # Avatar URL mapping dictionary for auto-log matching
│   └── hero.png          # Visual landing page hero image
├── components/
│   ├── dashboards/       # Role-specific dashboard layouts
│   └── ...               # Core reusable components (Navbar, ParticleBackground, etc.)
├── contexts/             # Global states (AuthContext, ThemeContext)
├── lib/                  # Utilities (Supabase client init, PDF generator helpers)
└── pages/                # Application page components
```
