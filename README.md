# MissingInc

A web application built with React and Firebase featuring user authentication (email/password and Google sign-in).

## Prerequisites

You need **Node.js** installed on your machine before running this project.

- Download and install from: https://nodejs.org 
- To verify it installed correctly, open a terminal and run:

```bash
node --version
npm --version
```

Both should print a version number.

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/PaulaReagan/MissingInc.git
cd MissingInc
```

### 2. Install dependencies

```bash
npm install
```

This will download all the required packages (React, Firebase, etc.).

### 3. Start the development server

```bash
npm run dev
```

You should see output like:

```
VITE ready in 200ms

➜  Local:   http://localhost:5173/
```

### 4. Open in your browser

Go to **http://localhost:5173** in your browser. You should see the login page.

- **Sign up** with an email, username, and password
- **Log in** with an existing account or with Google
- **Sign out** using the button in the top-right corner of the homepage

### 5. Stop the server

Press `Ctrl + C` in the terminal to stop the dev server.

## Tech Stack

- **React** — UI framework
- **Vite** — Build tool / dev server
- **Firebase Auth** — User authentication (email/password + Google)
- **Firestore** — Database for user profiles
- **React Router** — Client-side routing
