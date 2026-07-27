# User Change Registry

- Use `CHANGE_REQUESTS.md` as the project-local registry for deferred user change notes.
- Record new notes with the next sequential `CR-NNN` ID and status `ожидает`; do not implement them until the user says **«применить»** or explicitly asks to execute the changes.
- On **«применить»**, implement all pending items unless the user limits the scope.
- After implementation and verification, move completed items to `Применено` with a concise result and the checks run.
- Preserve this application as a standalone static site unless the user explicitly requests a different architecture.
