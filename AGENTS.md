# AGENTS.md

Rules for every contributor to CaptionYourVideo, human or AI agent. They are mandatory. A change that breaks one of them is not merged.

## Commands

| Task | Command |
|------|---------|
| Install | `bun install` |
| Run locally | `bun run start` (reads `input/input.mp4`, writes `output/output.mp4`) |
| Run in Docker | `docker compose up --build` |
| Test | `bun test` |
| Typecheck | `bun run typecheck` |

Use Bun, never Node: `bun <file>`, `bun test`, `bun install`, `bunx <tool>`. Bun loads `.env` itself, so do not add `dotenv`. Prefer `Bun.file`, `Bun.write`, `Bun.spawn` and `` Bun.$`cmd` `` over `node:fs` and `execa`.

## Architecture: Clean Architecture with a DDD core

Dependencies point inward only. An inner layer never imports an outer one.

```
main.ts               composition root: reads config, wires adapters into the use case
src/domain/           entities and rules. Pure TypeScript, no I/O, no SDKs, no Bun APIs
src/application/      use cases and the ports (interfaces) they need
src/infrastructure/   adapters that implement ports: Whisper, Claude, ASS, ffmpeg, fontkit, env config
prompts/              LLM prompts. Prompts are code; never inline them in TypeScript
scripts/              non-TypeScript helpers (Whisper runs through uv)
tests/                mirrors src/: tests/domain, tests/application, tests/infrastructure
```

- **Domain** (`Caption`, `CaptionPlan`, `CaptionTheme`, `Word`) owns the rules: a plan covers every word in order, keywords stay inside their caption, which color state a word is in. Put new business rules here first.
- **Application** (`CaptionVideo`) orchestrates the flow through ports only. It never knows about Anthropic, ffmpeg or files.
- **Infrastructure** is the only place that touches external SDKs, processes, the file system and environment variables. One adapter per external system.
- Validate at trust boundaries only: environment variables (`config.ts`) and LLM output (`assertValidCaptionPlan`). Trust internal code.
- Name things in the domain's language: caption, keyword, transcript, theme. No `utils`, `helpers` or `manager` modules.
- No speculative abstractions. A new port needs a real adapter and a test double that uses it.

## TDD is mandatory

Every change to behaviour follows red, green, refactor:

1. **Red.** Write a failing test that states the new behaviour. Run `bun test` and see it fail for the right reason.
2. **Green.** Write the least code that makes it pass.
3. **Refactor.** Clean up with the suite green.

A bug fix starts with a test that reproduces the bug and fails before the fix. A pull request that adds behaviour without a test is rejected.

| Layer | Test style |
|-------|------------|
| Domain | Unit tests, no mocks, no I/O |
| Application | Unit tests with hand-written fakes for each port |
| Infrastructure | Integration tests against the real tool when it is cheap and local (ffmpeg, libass, fontkit). Never call paid APIs in tests; test the logic around them (for example `CaptionStreamTracker`) |

## Code style

- No comments by default. A comment is only for a non-obvious *why*, one short line.
- No dead code, no `TODO`, no commented-out code.
- Strict TypeScript, no `any`. Named constants instead of magic numbers.
- Short functions with one job, early returns, descriptive names.
- No swallowed errors. Throw a named error class.
- Commit messages: one imperative sentence, at most 72 characters.

## Workflow: every change goes through a pull request

Never push to `main`. Every change, however small, lands through a pull request and follows these steps in order. The PR is the single place where a reviewer sees the plan, the progress and the proof.

### 1. Check

Confirm the tools are there before starting: `git`, `gh` (logged in), `bun`, `ffmpeg`, `uv`, and `docker` when the change touches the image. Stop and ask before installing anything on someone's machine.

### 2. Explore

Read before you design.

- Search open and closed PRs and issues for the same work: `gh pr list --state all --search "<terms>"`. If someone already did it, stop and say so.
- Trace the affected flow from `main.ts` through the use case to the adapter.
- List what you can reuse: domain functions, ports, test fakes, fixtures.
- Read the current docs for any library you will touch, for the installed version.

### 3. Plan first

Write the plan before any code:

- **Context:** what exists today and what you found in step 2.
- **Steps:** small, ordered, one commit each.
- **Test cases:** the checklist that proves the change. Each item names the test file and the behaviour it checks, plus one end-to-end check (`bun run start` or `docker compose up --build` on a real video).

### 4. Open a draft PR

```bash
git fetch origin
git switch -c <type>/<short-topic> origin/main
git commit --allow-empty -m "Start <short topic>"
git push -u origin HEAD
gh pr create --draft --title "<what changes for the user>" --body "Plan in progress"
```

Branch types: `feat/`, `fix/`, `chore/`, `docs/`, `test/`. One branch carries one reviewable change. Contributors without push access work from a fork and open the PR against upstream.

### 5. Write the plan into the draft PR

Replace the draft description with the plan from step 3, using `.github/pull_request_template.md`. The test-case checklist starts unticked.

### 6. Implement

Work through the steps with TDD (red, green, refactor). Each step ends in one commit. If reality forces a change to the plan, update the plan in the PR description first and say why.

### 7. Comment on the PR after every commit

After each commit, push and add a PR comment that says what the commit did and how it was checked:

```bash
git push
gh pr comment --body "<commit subject>: <what changed>. Checked with: <command and result>."
```

Tick the test cases in the PR description as they pass. The comment trail is the progress log; nobody should have to read the diff to know where the work stands.

### 8. Finalize the PR for review

When every step is done:

1. Run `bun run typecheck` and `bun test`; both must be clean.
2. Run the end-to-end check on a real video and attach still frames of the result (`ffmpeg -ss <t> -i output/output.mp4 -frames:v 1 frame.png`).
3. Update the PR description: summary, the fully ticked test-case checklist with real output, and anything not verified.
4. Run `git status` and confirm only intended files are in the diff. Never commit `.env`, `input/` or `output/` media.
5. Mark the PR ready: `gh pr ready`. Do not merge it yourself; merging is the reviewer's decision.

Never fake proof: no invented output, no frames from anything but the final code, no ticked test case without a run. If a step cannot be completed, say so in the PR and keep it as a draft.
