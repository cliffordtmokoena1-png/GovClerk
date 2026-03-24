# Minutes Prompt Templates Reference

This directory contains Handlebars templates used by the minutes-generation pipeline.
Templates are organised into three subfolders:

- `shared/` – reusable partials consumed across steps.
- `steps/` – user-facing prompts for each pipeline step or variant.
- `system/` – system messages paired with the step prompts.

## Shared Partials

| Partial | Description | Key Parameters |
| ------- | ----------- | -------------- |
| `_shared_minutes_intro.hbs` | Shared intro/wrapper guidelines for minutes generation. Handles custom template overrides and guideline flags. | `user_template`, `show_generate_paragraph`, `source_description`, `primary_source_label`, `has_inputs`, guideline flags, `context_heading`, `show_section_headings` |
| `_shared_final_minutes_instructions.hbs` | Default final-minutes prompt using `minutes_prompt_base` with transcript+notes context. | Inherits all base parameters; configures headings for notes/draft/feedback |
| `_shared_minutes_guidelines.hbs` | Guideline block controlling markdown/formatting requirements. | Boolean flags (`include_attendance_marker_note`, `include_speaker_label_constraint`, etc.) |
| `_minutes_prompt_base.hbs` | High-level scaffold that renders intro + context sections. | Passes through intro flags and heading overrides; expects `transcript`, `meeting_notes`, etc. |
| `_minutes_context_sections.hbs` | Renders transcript/notes/draft/feedback blocks conditionally. | `show_section_headings`, specific heading overrides |

## Step Templates (`steps/`)

| Template | Purpose | Notes |
| -------- | ------- | ----- |
| `meeting_notes.hbs` | Generates structured meeting notes from transcript. | Uses transcript content only. |
| `first_draft.hbs` | Produces first draft minutes (via shared instructions). | Delegates to `_shared_final_minutes_instructions.hbs`. |
| `final_minutes.hbs` | Generates final polished minutes. | Same as first draft (shared partial). |
| `oracle_feedback.hbs` | Provides reviewer feedback on drafts. | Structured critique format. |
| `regenerate_with_feedback.hbs` | Rewrites minutes using accumulated feedback. | Ensures instructions emphasize minimal changes + feedback adherence. |
| `finetuned_minutes_prefix.hbs` | Prefix prompt for finetuned model path. | Shares base partial with custom flag set. |
| `image_to_meeting_notes_prefix.hbs` | Image minutes pipeline prefix. | Works with image-based context. |
| `image_final_minutes_prefix.hbs` | Final minutes for image uploads. | Applies meeting-notes-only context. |

## System Templates (`system/`)

| Template | Purpose |
| -------- | ------- |
| `meeting_notes_system.hbs` | System prompt for meeting-notes step. |
| `first_draft` uses `final_minutes_system.hbs` | System prompt shared by draft/final generation. |
| `oracle_feedback_system.hbs` | System prompt for feedback stage. |
| `image_to_meeting_notes_system.hbs` | System prompt for image-based meeting notes. |
| `image_final_minutes_system.hbs` | System prompt for image final minutes. |

## Maintenance Tips

- When adding new prompts, choose the correct folder and register the template in `prompt_templates::init()`.
- Prefer storing reusable text in `shared/` partials to keep step templates focused on step-specific instructions.
- If you introduce new flags or parameters, document them in this reference to aid future contributors.
