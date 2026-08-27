# Supervisor No Visit Back Option Prompt

## Purpose
Use this prompt to request a UI fix for the supervisor visit wizard in the `app/supervisor/visit/page.tsx` file.

## Task
When a supervisor selects a route while `visitType` is `No Visit` and the No Visit reason form appears, add a visible "Back" option so the user can return to the previous selection step.

## Context
- This is for the supervisor portal only.
- The issue occurs in the No Visit flow after route selection.
- The existing screen already displays a route selector and the No Visit reason section.
- The fix should preserve the current wizard behavior and only add an easy way to go back.

## Desired output
- A code change in `app/supervisor/visit/page.tsx`.
- A back button or equivalent navigation control displayed when the No Visit reason option is visible.
- The button should return the user to the prior route/customer selection step without submitting anything.

## Example invocations
- "Add a Back button to the supervisor No Visit route selection flow."
- "When No Visit reason appears after route selection, show a back option in the supervisor visit wizard."

## Notes
- Prefer a small, focused UI change.
- Keep styling consistent with the existing supervisor visit page.
