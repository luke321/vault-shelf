# 0022 — The machine's marker picks the lock protocol

**Date** 2026-10-05 · **Status** accepted · **Origin** wintools#107 (the machine-wide lock rollout)

## Context

`scripts/lock.mjs` shares one root, `obsidian-vault-locks`, with every other writer on the
machine (`decisions/0011`, `decisions/0012`): the machine's PowerShell helper, vault-graph's
harness hook and WinTools. Each of them checks whether a name and its aliases are free, then
claims the directory. The check and the claim are separate steps, and they span several names:
`record` blocks every `screen-*`. So two writers can both see "free" and both claim, one
`record` and one `screen-left`. wintools#107's fixtures produce that interleaving on demand.

**atomic-lock-v1** closes it by putting every mutation, across every name, inside one `mkdir`
guard (`.mutation-v1.guard`). The guard never expires, because a suspended writer can resume after
any timeout. Records carry `protocol`, `since` and `holder`. A process hold must say how it stops
when the hold is lost (`onLost`). Uncertain metadata refuses rather than guessing.

Old and new must never run side by side on one machine: an old writer skips the guard and the race
is back. The machines share their scripts through sync and git, but each has its own lock root,
so the switch is per machine.

## Decision

- **A machine-local marker decides.** `<VAULT_LOCKS_HOME or tmpdir>/obsidian-vault-locks/protocol-v1.ready`
  is read by exact bytes on every call. With no file, `lock.mjs` behaves exactly as before; that is
  CI, every contributor's clone, and the selftest's throwaway roots. The exact bytes
  `atomic-lock-v1\n` hand every export to `scripts/lock-v1.mjs`. Anything else, a BOM included,
  refuses every lock, because half a rollout is the race this closes.
- **`lock-v1.mjs` is the common algorithm**, the same one the machine's helper and WinTools run.
  Its comments are pointers here, and the reasoning is this record.
- **The marker is published by the machine, never by this repo.** setup-amalgam's `switch-v1.ps1`
  writes it only when every writer on the machine knows it. It recognises this file by the
  literal `protocol-v1.ready` in it.

## Consequences

- Nothing changes until a machine switches. After that, a stale hold is no longer broken because
  its pid looks dead (`github#52`): v1 expires a lease only by its window. The heartbeat keeps a
  live run's hold fresh well inside that window.
- A caller that takes a process hold without `onLost` is refused under v1. `smoke.mjs` and
  `record-session.mjs` already pass one.
- Worktrees carrying the old `lock.mjs` keep their machine from switching until they are rebased
  or removed.
