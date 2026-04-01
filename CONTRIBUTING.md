# Contributing to GovClerk

Thank you for your interest in contributing to GovClerk! We welcome contributions from the community and are excited to work with you. Please take a few minutes to read through this guide before opening issues or pull requests.

---

## Code of Conduct

By participating in this project you agree to treat all contributors with respect, follow professional standards, and maintain a welcoming environment for everyone. A formal `CODE_OF_CONDUCT.md` will be added in a future update.

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/GovClerk.git
   cd GovClerk
   ```
3. Follow the setup instructions in each sub-package README for the area(s) you intend to work on:
   - Frontend: [`GovClerkMinutes/README.md`](GovClerkMinutes/README.md)
   - Python ML server: [`GovClerkMinutes-server/README.md`](GovClerkMinutes-server/README.md)
   - Node.js API server: [`govclerk-server-v2/README.md`](govclerk-server-v2/README.md)
   - Docker / RunPod deployment: [`RUNPOD_DEPLOY.md`](RUNPOD_DEPLOY.md)

---

## Branch Naming Convention

Use the following prefixes when naming your branches:

| Prefix | Purpose |
|---|---|
| `feat/short-description` | New features |
| `fix/short-description` | Bug fixes |
| `chore/short-description` | Maintenance tasks (deps, tooling, config) |
| `docs/short-description` | Documentation changes |

Examples: `feat/whatsapp-audio-upload`, `fix/paystack-webhook-signature`, `docs/update-rust-readme`

---

## Commit Message Convention

GovClerk follows the [Conventional Commits](https://www.conventionalcommits.org/) specification. Commit messages must be structured as:

```
<type>(<scope>): <short description>
```

Common types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

Common scopes: `frontend`, `api`, `rust`, `python`, `docker`, `auth`, `payments`, `whatsapp`

Examples:
```
feat(frontend): add audio upload progress bar
fix(api): handle empty transcript from AssemblyAI
chore(deps): bump assemblyai to 4.30.0
docs(rust): add RunPod deployment notes
```

---

## Pull Request Process

1. Ensure your branch is **up to date with `main`** before submitting:
   ```bash
   git fetch origin
   git rebase origin/main
   ```
2. **Run lint and tests** in the relevant sub-package before submitting (see [Sub-package Development](#sub-package-development) below).
3. **Fill out the PR template** fully — incomplete PRs may be closed without review.
4. **Link to any relevant issues** using `Closes #<issue-number>` in the PR description.
5. **Request a review** from a maintainer.

PRs that introduce breaking changes must clearly describe what breaks and provide a migration path.

---

## Sub-package Development

Run the development server for the sub-package you are working on:

**Frontend (Next.js)**
```bash
cd GovClerkMinutes
npm run dev
# or: bun run dev
```

**Node.js API Server**
```bash
cd govclerk-server-v2
npm run dev
```

**Python ML Server**
```bash
cd GovClerkMinutes-server
uvicorn main:app --reload
```

**Rust AI Backend**
```bash
cd GovClerkMinutes-server/rust
cargo run
```

---

## Reporting Bugs

Please use the **Bug Report** issue template when reporting a bug. Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behaviour
- Affected sub-package and version / commit SHA

---

## Requesting Features

Please use the **Feature Request** issue template when suggesting improvements. Describe the problem you want solved and your proposed solution.

---

## Security

**Do NOT open a public GitHub issue for security vulnerabilities.** Please follow the responsible disclosure process described in [SECURITY.md](SECURITY.md).
