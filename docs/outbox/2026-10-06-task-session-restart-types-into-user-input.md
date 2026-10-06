---
kind: task
from: tbl-md
date: 2026-10-06
---

# session-restart must not type into the input of the user

`session-restart` (`meta/dv/bin/session-restart`) sends `/exit` into the tmux pane of an interactive session. On 2026-10-06 the supervisor restarted tbl-md while the user typed a prompt in that pane. The keys mixed: the session received one prompt "big plan would be: write a discourse theme / plugin, that replaces tables inside markdown with tb/exit". Thus the restart did not happen, and the prompt of the user was damaged. The user confirmed it: "nein, der supervisor hat auch hier reingeschrieben".

Root cause: the script sends keys into a pane that the user can type into at the same time, and it does not make sure that the input line is empty first.

Possible fixes, to research: before the keys, read the input line with `tmux capture-pane` and stop with exit code 3 (not idle) if it is not empty. Or end the session with a mechanism that does not use the input line, for example a signal to the process of the pane, and start the new session with `tmux respawn-pane`.

Evidence: the transcript of the tbl-md session of 2026-10-06, the prompt after the hand-off of step 15.
