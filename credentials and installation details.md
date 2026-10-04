# Ash-Shāfī — Setup & Login Guide

## 1. Project Structure

This project contains three separate Node.js applications:

```text
Ash-Shāfī/
├── client/
│   ├── website/     # Public website / Homepage (Next.js)
│   └── web/         # Medical Management Dashboard (React + Vite)
│
└── server/          # Backend API (Node.js + Express)
```

Each application has its own `package.json`, so each one needs its own `node_modules`.

---

## 2. Requirements

Install these before running the project:

- Node.js 22+ recommended
- npm
- MongoDB
- Git (optional)

Check Node/npm:

```bash
node -v
npm -v
```

---

## 3. Installation

Open a terminal in the project root:

```bash
cd "Ash-Shāfī"
```

### Backend

```bash
cd server
npm install
```

Make sure `server/.env` exists and contains the required environment variables.

### Public Website

Open another terminal:

```bash
cd "client/website"
npm install
```

### Medical Dashboard

Open another terminal:

```bash
cd "client/web"
npm install
```

### Total installations

You need **3 separate `node_modules` folders**:

```text
server/node_modules
client/website/node_modules
client/web/node_modules
```

Do not install them into one shared folder.

---

# 4. Database

The backend uses MongoDB.

Make sure MongoDB is running and the `MONGODB_URI` / `MONGODB_DB_NAME` values in:

```text
server/.env
```

are correct.

After installation, run the database seed:

```bash
cd server
npm run seed
```

The seed command creates the protected Owner and Director accounts and the initial Admin account if they do not already exist.

> Important: the seed uses `OWNER_*`, `DIRECTOR_*`, and `INITIAL_ADMIN_PASSWORD` from `server/.env`.

---

# 5. Login Credentials

## Software Owner

| Field | Value |
|---|---|
| Name | Fahim Khan |
| Username | `owner` |
| Email | `fahimkhan9859@gmail.com` |
| Role | `SOFTWARE_OWNER` |
| Initial Password | `swindler` |

Login using:

```text
Username: owner
Password: swindler
```

---

## Director / Main Doctor

| Field | Value |
|---|---|
| Name | Ash-Shāfī |
| Username | `director` |
| Email | `antaraadiba5@gmail.com` |
| Role | `DIRECTOR` |
| Initial Password | `antara69` |

Login using:

```text
Username: director
Password: antara69
```

---

## Initial System Administrator

The database seed creates:

| Field | Value |
|---|---|
| Name | System Administrator |
| Username | `admin` |
| Email | `admin@ashshafi.local` |
| Role | `ADMIN` |
| Initial Password | `admin999` |

Login using:

```text
Username: admin
Password: admin999
```

### Important credential note

`server/.env` also contains:

```text
DEFAULT_ADMIN_EMAIL=admin@gmail.com
DEFAULT_ADMIN_PASSWORD=Admin@12345
```

These are configuration values exposed by the environment configuration, but the current `server/src/database/seed.js` creates the seeded Admin account with:

```text
Email: admin@ashshafi.local
Username: admin
Password: admin999
```

Therefore, for the database seed, use the `admin` credentials above.

---

## Demo Patient Account

The database seed creates a patient user account:

| Field | Value |
|---|---|
| Name | Demo Patient |
| Username | `patient` |
| Email | `patient@ashshafi.local` |
| Role | `PATIENT` |
| Initial Password | `patient123` |

Login using:

```text
Username: patient
Password: patient123
```

---

# 6. Run the Backend

Terminal 1:

```bash
cd "Ash-Shāfī/server"
npm run dev
```

Backend:

```text
http://localhost:5000
```

---

# 7. Run the Public Website / Homepage

Terminal 2:

```bash
cd "Ash-Shāfī/client/website"
npm run dev
```

Open:

```text
http://localhost:3000
```

This is the **public Ash-Shāfī homepage**.

---

# 8. Run the Medical Dashboard

Terminal 3:

```bash
cd "Ash-Shāfī/client/web"
npm run dev
```

Open:

```text
http://localhost:5173
```

This is the **authenticated medical management application**.

The dashboard root route redirects to the login page when the user is not authenticated.

---

# 9. Run Everything — Quick Start

After completing installation and configuring MongoDB:

### Terminal 1 — Backend

```bash
cd "Ash-Shāfī/server"
npm run dev
```

### Terminal 2 — Public Website

```bash
cd "Ash-Shāfī/client/website"
npm run dev
```

### Terminal 3 — Medical Dashboard

```bash
cd "Ash-Shāfī/client/web"
npm run dev
```

Then use:

| Application | URL |
|---|---|
| Public Website / Homepage | http://localhost:3000 |
| Medical Dashboard | http://localhost:5173 |
| Backend API | http://localhost:5000 |

---

# 10. Production Build

## Public Website

```bash
cd client/website
npm run build
npm start
```

## Medical Dashboard

```bash
cd client/web
npm run build
npm run preview
```

## Backend

```bash
cd server
npm start
```

---

# 11. Useful Backend Commands

```bash
npm run dev
npm start
npm run seed
npm run indexes
npm run check
npm run lint
npm run lint:fix
npm test
npm run test:watch
npm run test:coverage
```

---

# 12. If Login Does Not Work

Check the following in order:

1. MongoDB is running.
2. Backend is running on port `5000`.
3. `server/.env` exists.
4. The database connection values are correct.
5. Run:

```bash
cd server
npm run seed
```

6. Open the dashboard:

```text
http://localhost:5173
```

7. Try the seeded credentials listed above.

If the account already exists, the seed script does not recreate it or overwrite its password.

---

# 13. Important Security Warning

This README contains development/test login credentials.

**Do not use these passwords in production.**

Before production deployment:

- Change all initial passwords.
- Replace development secrets in `.env`.
- Use production MongoDB credentials.
- Use strong JWT secrets.
- Configure production CORS origins.
- Enable secure cookies/HTTPS.
- Never commit `.env` files containing secrets to Git.
- Do not publish this README with real production credentials.

The `server/.env` file contains sensitive infrastructure credentials and should be treated as secret.

---

# 14. First-Time Setup Checklist

- [ ] Install Node.js
- [ ] Install/start MongoDB
- [ ] Confirm `server/.env`
- [ ] Run `npm install` in `server`
- [ ] Run `npm install` in `client/website`
- [ ] Run `npm install` in `client/web`
- [ ] Run `npm run seed` in `server`
- [ ] Start backend on port 5000
- [ ] Start public website on port 3000
- [ ] Start dashboard on port 5173
- [ ] Test the public homepage
- [ ] Test Owner login
- [ ] Test Director login
- [ ] Test Admin login

---

## Quick Reference

```text
PUBLIC WEBSITE
http://localhost:3000

MEDICAL DASHBOARD
http://localhost:5173

BACKEND
http://localhost:5000
```

### Development Login Summary

```text
OWNER
Username: owner
Password: swindler

DIRECTOR
Username: director
Password: antara69

ADMIN
Username: admin
Password: admin999

PATIENT
Username: patient
Password: patient123
```
