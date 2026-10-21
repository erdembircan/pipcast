# OTSBox

The wall monitor behind the anchor: a chrome bezel around a small screen with the event's label on a glossy header, then what Claude asked or the one number that matters, then a footer.

- Provide `kind` and the content: for a permission ask, `command` (the command, or the tool and its target, one line in gold) and `quote` (Claude's own description of it); otherwise `quote` (three lines at most: what Claude asks, its last words when it finished with nothing changed, or the error in plain words), or `figure` and `sub` (finished with changes: "+182 −40" and "4 files changed"; the hour: "+1,546 −368" and the sessions), and `foot` ("Waiting 0:12", "Finished in 9 min"). A figure longer than nine characters steps down a size to stay on one line ("+12,480 −9,731").
- `label` overrides the story's label (CLAUDE ASKS, CHANGES, CLAUDE SAYS, THE ERROR, THIS HOUR). The header takes the story's colour: red when it needs you, green when it finished.
- With `animate` on its stage it powers on like a tube set.

Quote Claude, never paraphrase; only an error is put in plain words. Keep the footer to one line: it truncates rather than wraps, so it leaves out the time, which the ticker's clock already shows.
