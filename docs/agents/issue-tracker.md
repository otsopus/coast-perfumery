# Local Markdown issue tracker

Issues and specs live in `.scratch/`, with one directory per feature or effort.

- Specs go in `.scratch/<feature>/spec.md`.
- Implementation tickets go in `.scratch/<feature>/issues/NN-<slug>.md`, one file per ticket, numbered from `01`.
- Record ticket status in a `Status:` line near the top. Append discussion under `## Comments`.

When a skill publishes a spec or ticket, create it at the corresponding path. When a skill fetches a ticket, read the referenced file. Use the feature directory to resolve a ticket number when the feature is clear.

## Wayfinder

- Store the map at `.scratch/<effort>/map.md` with sections for Notes, Decisions-so-far, and Fog.
- Store each child ticket at `.scratch/<effort>/issues/NN-<slug>.md`. Put the question in the body and use a `Type:` line with one of `research`, `prototype`, `grilling`, or `task`.
- Record blocking tickets in a `Blocked by: NN, NN` line. A ticket becomes unblocked when all listed tickets are resolved.
- Work on the lowest-numbered open, unblocked, unclaimed ticket. Set `Status: claimed` and save before starting.
- To resolve a ticket, add the outcome under `## Answer`, set `Status: resolved`, and add a short summary and link to Decisions-so-far in the map.
