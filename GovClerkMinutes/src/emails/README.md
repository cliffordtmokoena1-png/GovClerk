# GovClerk Minutes — Postmark Email Templates

This directory contains the HTML source files for the Postmark email templates used by GovClerk Minutes.

---

## How to Create Templates in Postmark

1. Log in to your [Postmark account](https://account.postmarkapp.com).
2. Select your server.
3. Go to **Templates** in the left sidebar.
4. Click **"New Template"**.
5. Choose **"Code your own"**.
6. Set the **Template Name** and **Template Alias** as shown in the table below.
7. Paste the HTML file content into the **HTML body** field.
8. Save the template.

> **Important:** The alias must match exactly what is used in the code.

---

## Templates

| File | Template Alias | Subject Line |
|---|---|---|
| `govclerk-welcome.html` | `govclerk-welcome` | `Welcome to GovClerk Minutes!` |
| `govclerk-payment-confirmation.html` | `govclerk-payment-confirmation` | `Your {{plan_name}} subscription is now active!` |

---

## Template Variables

Postmark uses **Mustache-style** `{{variable}}` syntax for dynamic content.

### `govclerk-welcome` variables

| Variable | Description | Example |
|---|---|---|
| `{{first_name}}` | User's first name (or "there" if unknown) | `Cliff` |
| `{{dashboard_url}}` | Link to the user's dashboard | `https://govclerkminutes.com/dashboard?utm_medium=email` |
| `{{get_started_url}}` | Link to the getting started guide | `https://help.govclerkminutes.com/...` |
| `{{support_email}}` | Support email address | `support@govclerkminutes.com` |
| `{{company_name}}` | Company name | `GovClerk Minutes` |
| `{{current_year}}` | Current year for footer | `2026` |

### `govclerk-payment-confirmation` variables

| Variable | Description | Example |
|---|---|---|
| `{{first_name}}` | User's first name (or "there" if unknown) | `Cliff` |
| `{{plan_name}}` | Purchased plan name | `Annual` |
| `{{dashboard_url}}` | Link to the user's dashboard | `https://govclerkminutes.com/dashboard?utm_medium=email` |
| `{{support_email}}` | Support email address | `support@govclerkminutes.com` |
| `{{company_name}}` | Company name | `GovClerk Minutes` |
| `{{current_year}}` | Current year for footer | `2026` |

---

## Notes

- `{{variable}}` is Postmark's Mustache-style templating syntax. Variables are replaced at send time with the values provided in `TemplateModel`.
- Templates are stored in Postmark — these HTML files are the source of truth for editing and version control.
- After editing a template here, paste the updated HTML into the Postmark dashboard to apply the changes.
