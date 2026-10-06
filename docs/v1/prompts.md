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

**Output:** Started a one-question-at-a-time interview about the mortgage calculator v1 scope (goal, functional requirements, inputs and bounds, domain rules, out of scope, open questions).

## 6

````
A
````

**Output:** Recorded the answer and asked the next interview question.

## 7

````
D
````

**Output:** Recorded the answer and asked the next interview question.

## 8

````
D
````

**Output:** Recorded the answer and asked the next interview question.

## 9

````
A
````

**Output:** Recorded the answer and asked the next interview question.

## 10

````
A, B, C, tests with Vitest
````

**Output:** Recorded the choices, including testing with Vitest, and continued the interview.

## 11

````
A, down payment in %
````

**Output:** Recorded the choices, including down payment entered in percent, and continued the interview.

## 12

````
A, yes to both
````

**Output:** Recorded both confirmations and continued the interview.

## 13

````
A, month numbers only
````

**Output:** Recorded the choice (schedule shows month numbers only, no calendar dates) and continued the interview.

## 14

````
add Charts and visualizations
````

**Output:** Added charts and visualizations to the scope and asked follow-up questions about them.

## 15

````
A, B, Chart.js, English
````

**Output:** Recorded the choices, including Chart.js and an English UI, and continued toward the final summary.

## 16

````
Accept all except for number format, use slovak
````

**Output:** Showed the proposed spec; accepted everything except number format, which was changed to Slovak style (`1 234,56 €`).

## 17

````
It's great commit and push the file
````

**Output:** Wrote the final spec to `docs/v1/01-functional.md`, then committed and pushed it with the prompt log.

## 18

````
commit it to main and remove add-prompt-logging branch
````

**Output:** Committed the pending changes to `main` and removed the `add-prompt-logging` branch.

## 19

````
modify claude.md so that each log features small description of your output to each promt
````

**Output:** Updated `CLAUDE.md` so every prompt log entry also includes a short description of Claude's output.

## 20

````
yes, backfill and commit and push
````

**Output:** Backfilled `**Output:**` descriptions for entries 1–4, then committed and pushed to the `add-prompt-logging` branch (PR #1).

## 21

````
yes, write descriptions for 5–18
````

**Output:** Added `**Output:**` descriptions for entries 5–18, inferred from the commit history and `01-functional.md`.

## 22

````
yes, push it
````

**Output:** Pushed the pending commit to `origin/main`, with this prompt logged.

## 23

````
Read docs/v1/01-functional.md. Propose a modular architecture. For each module give responsibility, interface and which requirements it implements. Ask me quetions, then show result before writing it to 02-architecture.md. Suggested topics are stack, modules, dependencies direction, data model, decisions
````

**Output:** Read the functional spec, asked five design questions (module format, UI style, money math, validation), and presented a draft architecture in chat for review. Nothing written to `02-architecture.md` yet.

## 24

````
Why did you choose this data model, what are its benefits, can it be done differently
````

**Output:** Explained the reasoning behind the proposed data model (raw/validated/result split, integer cents, a flat state object), its benefits, and alternatives such as floats, decimal libraries, normalized schedule data, and a discriminated-union state. Nothing was written to `02-architecture.md`.

## 25

````
use the discriminated union and derive state, then write it
````

**Output:** Wrote `docs/v1/02-architecture.md` (it existed but was empty) with the stack, modules, dependency direction, data model, data flow, decisions and testing notes. It uses a discriminated-union `Outcome` derived from `raw` as the only stored state.

## 26

````
commit and push all changes
````

**Output:** Committed the architecture doc and prompt log updates on `main` and pushed to `origin/main`.

## 27

````
Read docs/v1/01-functional.md and docs/v1/02-architecture.md. Propose test scenarios in the required table. List edge cases I have not mentioned. Add info such as: test name, level, purpose,input and output, type. Ask me questions if needed show result, if approved write it to 03-test-scenarios.md
````

**Output:** Read the functional spec and architecture, asked four format/scope questions, then presented a draft test-scenario table (unit, integration, E2E), a list of unmentioned edge cases and open decisions in chat for approval. Nothing written to `03-test-scenarios.md` yet.

## 28

````
approve all, commit and push
````

**Output:** Wrote `docs/v1/03-test-scenarios.md` with the approved unit, integration and E2E scenario tables, edge cases and decisions D1-D8, then committed and pushed to `origin/main`.

## 29

````
You are an independent reviewer. You did not write this plan.
Read only docs/v1/01-functional.md, 02-architecture.md, 03-test-scenarios.md.
Do not trust claims; check them.
1. Coverage: every requirement has a module and a test; every test checks a real requirement.
2. Find ambiguous requirements that allow two implementations with different results.
3. List missing edge cases and invalid inputs.
4. For 3 out-of-scope features, describe exactly which modules must change.
5. Recompute every reference value in a separate script. Do not estimate.
Return numbered findings as a table with severity (blocker / major / minor) and what each affects.
Do not modify any file.

Save all the findings to 04-review.md
````

**Output:** Reviewed the three docs independently, recomputed all reference values with exact-arithmetic and float-simulation scripts, and saved 20 numbered findings (4 blockers, 7 majors, 9 minors), coverage matrix, ambiguities, edge cases and out-of-scope impact analysis to `docs/v1/04-review.md`.

## 30

````
transfer all data to file with correct spelling, delete incorrect one, then commit and push
````

**Output:** Moved the review into the correctly spelled `docs/v1/04-review.md` (the existing file was empty), deleted `04-review.md`, then committed and pushed.

## 31

````
Read docs/v1/01-functional.md to docs/v1/04-review.md. Write docs/v1/05-plan.md in the required structure. Acceptance criteria must list concrete tests only
````

**Output:** Wrote `docs/v1/05-plan.md`: decisions P1-P10 closing the review findings, corrected reference values (recomputed with an exact script), and steps 0-8 whose acceptance criteria are only concrete test IDs with expected values. The repo defines no "required structure", so I chose one and said so in the file.

## 32

````
Read 05-plan.md, without writing code, explain what you would build first and how you would know you are done
````

**Output:** Read `05-plan.md` and explained, without writing code, that the first build is Step 0 (tooling plus the golden fixtures from `tools/reference.py`, closed by test T-00) followed by the pure modules, and that "done" means the Section 5 definition of done: both test suites green with no skips, every test ID present, golden file reproducible, and docs synced (Step 8).

## 32

````
Do not reference any other file in the plan, it has to be copmlete start to end plan for whole project. Make it concise and complete.  Suggested categories: Objectives of V1, scope, Acceptance criteria, building order, defenition of done, building tools
````

**Output:** Rewrote `docs/v1/05-plan.md` as a self-contained plan with no references to other files: objectives, scope (requirements, rules, parsing, architecture, out of scope), acceptance criteria as concrete tests only, building order, definition of done and tools.

## 33

````
Read 05-plan.md, without writing code, explain what you would build first and how you would know you are done
````

**Output:** Re-read the rewritten self-contained `05-plan.md` and explained, without writing code, that the first build is Step 0 (tooling, smoke test and the Python golden-schedule reference), then the pure modules, and that "done" is Section 5: both suites green with no skips, every test ID present, golden file reproducible, FR1-FR9 each covered by a passing test. Noted that `prompts.md` has two entries numbered 32.

## 34

````
does plan feature only scripts, or html and visuals to?
````

**Output:** Answered that the plan covers the HTML page, CSS, summary, schedule table and two Chart.js charts, not only scripts, and noted that visuals are verified by DOM and Chart.js data checks rather than by looks.

## 33

````
commit and push this plan
````

**Output:** Committed `05-plan.md` and the prompt log (prompts 31-33) and pushed to `origin/main`.
