# Documentation map

Canonical documentation for NainOrder. Numbered by lifecycle phase. Feature work lives in
`../specs/NNN-feature-name/` and consolidates here.

| Phase | Document | Status |
| :--- | :--- | :--- |
| Planning | [00-charter.md](00-charter.md) | Draft |
| Analysis | [10-requirements.md](10-requirements.md) | Draft |
| Analysis | [11-open-questions.md](11-open-questions.md) | Open |
| Design | [20-architecture.md](20-architecture.md) | Draft |
| Design | [21-data-model.md](21-data-model.md) | Draft |
| Design | [30-decisions/](30-decisions/) | see each ADR |
| Development | [40-tasks.md](40-tasks.md) | Active |
| Development | [41-blockers.md](41-blockers.md) | Active |
| Testing | [50-traceability.md](50-traceability.md) | Active |
| Deployment | [60-runbook.md](60-runbook.md) | Draft |
| Maintenance | [90-changelog.md](90-changelog.md) | Active |

## How to work here

1. Any change starts in a specification, never in the code.
2. Stable requirements get a `REQ-###` entry in [10-requirements.md](10-requirements.md).
   Ambiguities go to [11-open-questions.md](11-open-questions.md) and block their requirement.
3. Significant decisions become ADRs under [30-decisions/](30-decisions/), status `Proposed`.
   Only the owner promotes one to `Approved`.
4. One task at a time, test first.
5. Every requirement maps to a passing test in [50-traceability.md](50-traceability.md). A
   requirement with no test is not done, whatever the code says.

The operational contract for agents is [`../AGENTS.md`](../AGENTS.md).

## Task labels

| Label | Meaning |
| :--- | :--- |
| `[A]` | The agent completes it alone. |
| `[M]` | Mixed: the agent does its part but needs a human action to close it. |
| `[H]` | Human only: accounts, credentials, payments, terms, business decisions. |
