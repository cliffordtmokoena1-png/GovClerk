# Security Policy

## Supported Versions

The following versions of GovClerk are currently receiving security updates:

| Version / Branch | Supported |
|---|---|
| `main` | ✅ Yes |
| All other branches | ❌ No |

---

## Reporting a Vulnerability

**Please do NOT open a public GitHub issue for security vulnerabilities.** Publicly disclosing a vulnerability before a fix is in place puts all users at risk.

### How to Report

Send an email to **security@govclerk.co.za** with the following information:

1. **Description** — A clear description of the vulnerability
2. **Steps to Reproduce** — Detailed steps that demonstrate the issue
3. **Potential Impact** — What an attacker could achieve by exploiting it
4. **Suggested Fix** _(optional)_ — Any ideas you have for remediation

### Response Times

| Milestone | Target |
|---|---|
| Acknowledgement | Within **48 hours** of receiving your report |
| Status update | Within **7 days** |
| Fix for critical issues | Within **14 days** |
| Fix for high/medium issues | Within **30 days** |

We will keep you informed throughout the process and credit you in the release notes (unless you prefer to remain anonymous).

---

## Scope

### In Scope

- The GovClerk web application (https://my-gen-minutes-bgli.vercel.app)
- API endpoints (Sophon API server, Rust backend, Python ML server)
- Authentication and authorisation flows (Clerk integration)
- Data handling — meeting audio, transcripts, minutes, PII
- Payment flows (Paystack integration)
- WhatsApp message delivery

### Out of Scope

The following are managed by third-party providers and should be reported directly to them:

- [Clerk](https://clerk.com/security) — authentication platform
- [Paystack](https://paystack.com/security) — payment processor
- [AssemblyAI](https://www.assemblyai.com/security) — transcription API
- [AWS S3](https://aws.amazon.com/security/vulnerability-reporting/) — object storage
- [Vercel](https://vercel.com/security) — hosting platform
- [Railway](https://railway.com) — hosting platform

---

## Responsible Disclosure

We deeply appreciate security researchers who take the time to responsibly disclose vulnerabilities. We are committed to working with you to understand and address the issue promptly. Researchers who follow this policy will be publicly acknowledged (with their permission) in our release notes.

Thank you for helping keep GovClerk and its users safe. 🙏
