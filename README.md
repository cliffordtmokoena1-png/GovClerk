# GovClerk

> AI-powered meeting minutes automation for South African government

[![Live App](https://img.shields.io/badge/Live%20App-Vercel-black?logo=vercel)](https://my-gen-minutes-bgli.vercel.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

GovClerk automates the entire government meeting minutes workflow: upload an audio recording of a government meeting → AI transcription with speaker diarization → auto-generated, structured minutes → export to PDF or deliver via WhatsApp.

Built for South African government bodies (municipalities, councils, boards), GovClerk reduces the hours of manual transcription and minute-writing to minutes.

---

## Architecture Overview

| Service | Directory | Tech | Port | Hosting |
|---|---|---|---|---|
| Frontend (Next.js) | `GovClerkMinutes/` | TypeScript, Next.js, Tailwind CSS | 3223 | Vercel |
| Sophon API Server | `govclerk-server-v2/` | TypeScript, Node.js, Hono | 8000 | Railway |
| Rust AI Backend | `GovClerkMinutes-server/rust/` | Rust (Axum) | 8000 | RunPod GPU |
| Python ML Server | `GovClerkMinutes-server/` | Python, FastAPI, AssemblyAI | 8000 | RunPod |

---

## Features

- 🎙️ **Audio Upload** — Upload `.mp3`, `.wav`, or `.m4a` recordings from any device
- 🗣️ **Speaker Diarization** — Automatically identifies and labels individual speakers
- 📝 **AI Transcription** — Powered by AssemblyAI and OpenAI Whisper
- 📄 **Auto-Generated Minutes** — Structured, agenda-ready minutes produced by LLMs via OpenRouter
- 💬 **WhatsApp Delivery** — Send minutes directly to WhatsApp groups or individuals
- 💳 **Payments** — Subscription and per-use billing via Paystack
- 📤 **PDF Export** — One-click PDF export of meeting minutes
- 🔐 **Authentication** — Clerk-powered auth with organisation support

---

## Prerequisites

Before setting up any sub-package, ensure you have the following installed:

- [Node.js 20+](https://nodejs.org/)
- [Bun](https://bun.sh/) — used by the frontend
- [Rust 1.94+](https://rustup.rs/) — for the Rust backend
- [Python 3.11](https://www.python.org/) — for the ML server
- [Docker](https://www.docker.com/) — for containerised deployments
- [Conda / Miniconda](https://docs.conda.io/en/latest/miniconda.html) — for the Python ML environment

---

## Quick Start

Each sub-package has its own README with detailed setup instructions:

| Sub-package | README |
|---|---|
| Frontend (Next.js) | [`GovClerkMinutes/README.md`](GovClerkMinutes/README.md) |
| Python ML Server | [`GovClerkMinutes-server/README.md`](GovClerkMinutes-server/README.md) |
| Node.js API Server | [`govclerk-server-v2/README.md`](govclerk-server-v2/README.md) |
| Docker / RunPod Deployment | [`RUNPOD_DEPLOY.md`](RUNPOD_DEPLOY.md) |

---

## Environment Variables

Each sub-package manages its own environment variables. Copy the relevant `.env.example` and fill in your values:

| Sub-package | Example file | Key variables |
|---|---|---|
| Frontend | [`GovClerkMinutes/.env.example`](GovClerkMinutes/.env.example) | Clerk auth, Paystack, AWS S3, OpenRouter, PostHog, Twilio, WhatsApp, Postmark |
| Node.js server | [`govclerk-server-v2/.env.example`](govclerk-server-v2/.env.example) | AssemblyAI, Clerk, database |
| Rust server | Runtime env in Docker container | `PORT`, `PUBLIC_KEY`, `UPLOAD_COMPLETE_WEBHOOK_SECRET` |
| Python ML server | See [`GovClerkMinutes-server/README.md`](GovClerkMinutes-server/README.md) | `ASSEMBLYAI_API_KEY`, `HUMDINGER_KEY`, AWS credentials |

A combined reference of all variables is also available in [`.env.example`](.env.example) at the root.

---

## Tech Stack

- **Frontend**: Next.js · TypeScript · Tailwind CSS · Clerk · shadcn/ui
- **API Server**: Node.js · TypeScript · Hono · Express
- **AI Backend**: Rust · Axum · Tokio
- **ML Server**: Python · FastAPI · AssemblyAI · OpenAI Whisper
- **Database**: PlanetScale (MySQL-compatible)
- **Storage**: AWS S3 (af-south-1)
- **Auth**: Clerk
- **Payments**: Paystack
- **Messaging**: WhatsApp Business API · Twilio · Postmark
- **AI Models**: OpenRouter · AssemblyAI · OpenAI Whisper
- **Infra**: Vercel · Railway · RunPod · Docker

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

---

## Security

For security vulnerabilities, **do not open a public GitHub issue**. Please follow the process described in [SECURITY.md](SECURITY.md).

---

## License

This project is licensed under the [MIT License](LICENSE).
