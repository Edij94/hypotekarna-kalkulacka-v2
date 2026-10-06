# Prompts

Log of all user prompts in this project, in chronological order.

## 1

````
hypotekarna-kalkulacka-v2/
├── README.md
├── CLAUDE.md
├── docs/
│   ├── handoff.md        (prenos medzi sessions, /end-session)
│   └── v1/
│       ├── 01-functional.md
│       ├── 02-architecture.md
│       ├── 03-test-scenarios.md
│       ├── 04-review.md
│       ├── 05-plan.md
│       ├── 06-retro.md
│       └── prompts.md
└── .claude/              (skills, agents, hooks, ak ich používate)

make this structure within the folder
````

**Output:** Created the requested folder and file structure (empty `.md` files plus `.claude/.gitkeep`).

## 2

````
initialize git commit all files and push them into new public gitHub repo
````

**Output:** Initialized git, committed all 11 files and pushed them to a new public GitHub repo, `Edij94/hypotekarna-kalkulacka-v2`.

## 3

````
Write all of my prompts within this session in prompts.md file, modify CLAUDE.md in this folder, so that every prompt is added to prompts.md
````

**Output:** Wrote prompts 1–3 into `docs/v1/prompts.md` and added a prompt-logging rule to `CLAUDE.md`.

## 4

````
<create-pr-command>
## Overview

Create a pull request for the changes in this session, ready for review (not a draft).

## Steps

1. Check for uncommitted changes. If any exist, stage and commit them with a message that describes what changed and why.
2. Push the branch to the remote.
3. Open the PR with `gh pr create`. Do not pass `--draft`: the user chose “Create PR”, not “Create draft PR”, for this request, and that explicit choice overrides any saved memory, standing instruction, or earlier plan to open it as a draft. When the target below names a base branch and that branch exists on origin (`git ls-remote --heads origin <base>`), pass it with `--base`; otherwise leave `--base` off and let gh infer it. Write a title that summarizes the change and a body that covers what changed, why, and anything a reviewer should know. If the repo has a PR template, follow it.
4. Report the PR URL when done. Wrap the URL in a `<pr-created>` tag on its own line so the UI can render a live status card, like this: `<pr-created>https://github.com/owner/repo/pull/123</pr-created>`

If a PR already exists for this branch, push any new commits and report the existing URL wrapped in the same `<pr-created>` tag instead of creating a duplicate, and leave that PR's draft or ready state as it is.

## Target

Repository: Edij94/hypotekarna-kalkulacka-v2
Branch: main
Working directory: D:\pda\hypotekarna-kalkulacka-v2
</create-pr-command>
````

**Output:** Created branch `add-prompt-logging`, committed the changes, pushed it and opened PR #1 (ready for review).

## 5

````
Interwiev me about technical scope of mortgage calculator v1, include questions about: project goal, functional requirements, inputs and their bounds, domain rules, what's out of scope of v1, open questions. Ask one question at the time, after this show me result if approved write it to docs/v1/01_functional.md
````

## 6

````
A
````

## 7

````
D
````

## 8

````
D
````

## 9

````
A
````

## 10

````
A, B, C, tests with Vitest
````

## 11

````
A, down payment in %
````

## 12

````
A, yes to both
````

## 13

````
A, month numbers only
````

## 14

````
add Charts and visualizations
````

## 15

````
A, B, Chart.js, English
````

## 16

````
Accept all except for number format, use slovak
````

## 17

````
It's great commit and push the file
````

## 18

````
commit it to main and remove add-prompt-logging branch
````

## 5

````
modify claude.md so that each log features small description of your output to each promt
````

**Output:** Updated `CLAUDE.md` so every prompt log entry also includes a short description of Claude's output.

## 6

````
yes, backfill and commit and push
````

**Output:** Backfilled `**Output:**` descriptions for entries 1–4, then committed and pushed to the `add-prompt-logging` branch (PR #1).
