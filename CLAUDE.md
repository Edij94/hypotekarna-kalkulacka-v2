# Project instructions

## Prompt logging

- Every user prompt must be appended to `docs/v1/prompts.md`.
- Log the prompt at the start of handling it, before any other work.
- Format of each entry:
  - A `## <n>` heading (next sequential number).
  - The prompt verbatim in a fenced code block (use four backticks so prompts containing code fences are preserved).
  - Below the block, a line `**Output:**` followed by a short description (1-2 sentences) of what Claude did or answered in response to that prompt.
- Add the `**Output:**` description at the end of the turn, once the work is done, so it reflects what was actually produced.
- Never edit or remove earlier entries; only append (the only allowed edit to an existing entry is adding its own `**Output:**` line).
