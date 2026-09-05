# CIVICAI

### **"One Platform. Every Civic Issue."**
> **"See an Issue. Capture It. Let AI Understand It. Report It. Track It. Resolve It."**

CivicAI is a production-quality, modern, and intelligent **Unified Citizen Civic Issue Reporting & Management Platform** developed for Smart Cities and the **Smart India Hackathon (SIH)**.

---

## 🌟 Key Features

1. **Unified Municipal Coverage across 9 Civic Categories**:
   - 🛣️ **Roads & Transportation**: Potholes, damaged roads, broken footpaths, unfinished road work.
   - 💧 **Water & Drainage**: Pipeline bursts, flooding, waterlogging, blocked storm drains, sewage overflow.
   - ⚡ **Electricity & Lighting**: Broken streetlights, damaged poles, exposed electrical wires.
   - 🗑️ **Sanitation & Waste**: Garbage accumulation, overflowing bins, illegal dumping, health hazards.
   - 🏛️ **Public Infrastructure**: Damaged bus stops, broken park benches, unsafe public property.
   - 🚧 **Construction**: Unsafe excavation, abandoned construction debris, missing barricades.
   - 🚦 **Traffic & Signage**: Damaged signals, missing direction boards, hazardous road signs.
   - 🌳 **Environment**: Fallen trees, polluted lakes, open waste burning.
   - ❓ **Other Civic Issues**: Any unclassified municipal public problem.

2. **AI Multimodal Diagnostics Pipeline**:
   - Integrated with **Google Gemini Vision API** (`gemini-1.5-flash`) + High-Accuracy Client-Side Deep Edge Vision Classifier.
   - Returns detected issue name, category recommendation, confidence score (High 90-100%, Moderate 70-89%, Low <70%), urgency/severity level with safety rationale, visual explanation, and auto-generated citizen report description.
   - High-tech AI Scanning HUD animation with laser sweep and target reticle.

3. **Dynamic Category Forms & Map Pinning**:
   - Form fields adapt dynamically based on chosen category (e.g. depth of pothole, pipeline pressure, pole number).
   - **Leaflet + OpenStreetMap** interactive pin-drop map with GPS "Use Current Location" and automatic reverse geocoding to street address and city.
   - Generates human-friendly public Report IDs: `CIV-2026-XXXXX`.

4. **Dedicated Role-Based Portals**:
   - **Citizen Dashboard**: Live metrics, search & multi-filter by category/status/severity, report card grid, and full detail views.
   - **Authority Command Center**: Department triage, SLA tracking, status transition modal (`Submitted` ➔ `Under Review` ➔ `Assigned` ➔ `In Progress` ➔ `Resolved`), department re-assignment, and official inspection audit logs.
   - **Public Report Tracker**: Public lookup by `CIV-2026-XXXXX` with step-by-step resolution lifecycle timeline.

5. **Cloud Backend & Database**:
   - Native **Supabase** integration (PostgreSQL DB with Row Level Security, Storage, Realtime pub/sub, Auth).
   - Built-in Local-First fallback engine so the entire application functions offline/out of the box with realistic seed data.
   - PostgreSQL schema script included at `database/schema.sql`.

---

## 🚀 Getting Started

### 1. Direct Browser Launch
Simply open `index.html` in any modern web browser or serve via a local HTTP server:

```powershell
# Using Python
python -m http.server 3000

# Using Node.js (npx serve)
npx serve .
```

Navigate to `http://localhost:3000`.

### 2. Shared Supabase Cloud Configuration (Required for multi-device reports)

The application no longer stores reports only in a browser. Configure one shared
Supabase project so a report submitted from any phone or laptop appears in the
admin dashboard.

1. Create a Supabase project and run the complete [`database/schema.sql`](database/schema.sql)
   file in **SQL Editor**.
2. In **Authentication → URL Configuration**, add your Vercel URL to **Site URL**
   and **Redirect URLs**. For the simplest first test, turn off **Confirm email**
   in Authentication → Providers → Email; otherwise new users must verify their
   email before signing in.
3. Copy `CivicAI/.env.example` to `CivicAI/.env` and fill in the Supabase URL and
   anon key for local development. Never commit this file.
4. In **Vercel → Project → Settings → Environment Variables**, add these values
   for **Production**, then redeploy:

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key — server only, never `VITE_` |
   | `VITE_SUPER_ADMIN_EMAIL` | Your administrator email (optional convenience only) |

5. Create your own account through CivicAI, then run the final commented `UPDATE`
   command at the bottom of `database/schema.sql`, substituting your email. This
   grants the first Super Admin account. That account can create other municipal
   officers from the dashboard.

`VITE_SUPABASE_ANON_KEY` is intentionally public in a Vite application. The
database schema's Row Level Security policies protect the data. The service-role
key is private and is used only by the Vercel `/api/admin-officers` function.

### 3. Google Gemini Vision Key (Optional)
To enable live Gemini Vision Multimodal scanning with your own API key, go to **Profile / Settings** inside CivicAI and paste your `Gemini API Key`.

---

## 🏗️ Project Structure

```
CivicAI/
├── index.html                   # Main single-page application shell
├── README.md                    # Project documentation & SIH reference
├── database/
│   └── schema.sql               # PostgreSQL DDL with RLS, triggers & indexes
├── styles/
│   ├── main.css                 # Theme variables, typography, reset & layout
│   ├── components.css           # Navigation, buttons, badges, modals, toasts
│   ├── ai-scanner.css           # AI scanner HUD, radar animations, diagnostic cards
│   ├── forms.css                # 5-step report wizard & dynamic category forms
│   └── dashboards.css           # Citizen & Authority analytics, tables, timelines
└── js/
    ├── config.js                # Civic taxonomy, dynamic field definitions & config
    ├── supabase-client.js       # Supabase client SDK & image storage wrapper
    ├── storage-db.js            # Unified data layer with offline persistence & pub/sub
    ├── ai-vision-service.js     # Gemini Vision API & Deep Edge Vision classifier
    ├── location-service.js      # Leaflet map, GPS & OpenStreetMap reverse geocoding
    ├── auth-service.js          # Authentication & citizen/authority role switching
    ├── notification-service.js  # Realtime notification engine & toast alerts
    ├── app.js                   # Application router & modal controller
    └── views/
        ├── home.js              # Hero, dynamic category grid, AI showcase & timeline
        ├── report.js            # 5-step report wizard (Photo -> AI -> Form -> Map -> Submit)
        ├── track.js             # Public report tracker with animated progress timeline
        ├── citizen-dash.js      # Citizen dashboard with stats, search & filters
        ├── authority-dash.js    # Authority portal with workload management & status transitions
        ├── profile.js           # User profile, role switcher & cloud settings
        └── about.js             # About CivicAI & "AI That Assists, Not Replaces" manifesto
```

---

## 🔒 Security & Architecture Standards
- **Zero plain-text password storage** (Supabase Auth / Bcrypt hashing).
- **Row Level Security (RLS)** strictly enforced on all tables.
- **Normal system cursor preserved** (No gimmicky cursor effects).
- **100% accessible, responsive, and cross-browser compatible**.

---

© 2026 **CivicAI** — *One Platform. Every Civic Issue.*
