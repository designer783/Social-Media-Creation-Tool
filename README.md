# Social Media Asset Generation & Blog Studio

An enterprise-grade AI Creative & Editorial Production Studio built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, and **Google Gemini AI**.

---

## Key Features

1. **Blog Studio (SEO Articles & Featured Visuals)**:
   - 3-step structured workflow: Topic & Keywords $\to$ SEO Intelligence & Interactive Outline Gate $\to$ Complete Article & Featured Image.
   - Configurable featured image dimensions (Square `1080×1080`, Landscape `1200×675`, Portrait `1080×1350`, Rectangle `1200×628`, or custom dimensions).
   - Real-time AI image generation with interactive prompt authoring and refinement.
   - Live reader-facing blog preview (Desktop & Mobile viewports) with typography, table of contents, grounded sources, FAQs, and Markdown export.
   - Humane, anti-AI editorial writing with smart keyword deduplication and zero cutoff text.
2. **Creative Studio (Social Media Asset Generation)**:
   - Multi-platform post generation across 7 platform presets (Instagram, LinkedIn, X/Twitter, Facebook, Pinterest).
   - Real-time supportive graphics, typography hierarchy, and brand-consistent layouts.
   - Version history and multi-selection batch export.
3. **Admin Security Gate & Multi-User Login**:
   - The studio is strictly locked behind an administrative authentication gate.
   - **Concurrent Multi-Login Supported**: Multiple team members can log in simultaneously using the single shared admin credential.
4. **Interactive Processing Popup**:
   - Real-time animated modal overlay with dynamic task progress across every API operation.

---

## Admin Credentials & Security Gate

When the application loads, visitors must authenticate to access any workspace or module.

| Field | Default Value | Environment Variable |
|---|---|---|
| **Admin ID / Email** | `admin@socialstudio.local` (or `admin`) | `ADMIN_EMAIL` |
| **Admin Password** | `admin123` | `ADMIN_PASSWORD` |
| **Admin Name** | `Studio Admin` | `ADMIN_NAME` |

> **Multi-User Access**: Multiple team members and devices can all log in concurrently using this single admin credential without kicking each other out.

To customize the admin credentials, simply define `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your deployment environment variables (e.g. on Vercel, Railway, or in `.env.local`).

---

## Git Upload & Deployment Guide

### 1. Push to GitHub / Git Remote

This repository is completely Git-ready with sensitive files (`.env.local`, SQLite databases, build artifacts) properly excluded in `.gitignore`.

```bash
# 1. Initialize git (if not already done)
git init

# 2. Stage all files and commit
git add .
git commit -m "feat: complete Social Media Studio with Blog Studio, admin lock, and multi-user support"

# 3. Rename branch to main
git branch -M main

# 4. Add your GitHub/GitLab remote repository
git remote add origin https://github.com/<your-username>/<your-repo-name>.git

# 5. Push code to Git
git push -u origin main
```

---

## Incorporating APIs After Deployment

You do **not** need to include API keys before Git upload. You can incorporate them cleanly after deployment using either of two methods:

### Method A: Environment Variables (Recommended for Deployments)
Add the following in your hosting provider's dashboard (e.g. Vercel Project Settings $\to$ Environment Variables):

```bash
GEMINI_API_KEY=AIzaSy...your-gemini-key
HF_API_TOKEN=hf_...your-huggingface-token (optional)
ADMIN_EMAIL=your-custom-admin@yourdomain.com
ADMIN_PASSWORD=YourStrongPassword123!
```

### Method B: Directly in the Web UI
Once the site is deployed:
1. Log in with your admin credentials.
2. In the top navigation header, click the **"Gemini API"** key badge.
3. Paste your Gemini API key (`AIza...`).
4. Select the connection scope:
   - **Workspace Shared Key**: Available to all team members in the active workspace.
   - **Personal User Key**: Encrypted private key for your session.
5. Click **Connect & Save**. The key will be encrypted at rest using AES-256-GCM.

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) and unlock the studio with `admin@socialstudio.local` / `admin123`.

---

## Verification & Testing

Run the automated test suite (36 tests covering all modules, database isolation, outline approval gates, and anti-truncation):

```bash
npm test
```
