# ADR-0003: No verifiers or multi-candidate search without measured improvement

- Status: accepted
- Date: 2026-05-13

## Context

Tsinghua's NLH ablation study (March 2026) ran module-by-module removal experiments on SWE-bench and OS-World. Two categories of harness modules that _sound_ helpful — verifiers and multi-candidate search — actively hurt performance:

- Verifiers: −0.8 (SWE-bench), −8.4 (OS-World)
- Multi-candidate search: −2.4 (SWE-bench), −5.6 (OS-World)

The only module that consistently helped was self-evolution (acceptance-gated narrowing): +4.8 (SWE-bench), +2.7 (OS-World).

Anthropic's own evolution confirms this: their three-agent GAN architecture (planner → generator → evaluator) was 20x more expensive ($200 vs $9 per task) with marginal gains. Vercel removed 80% of an agent's tools and got better results.

The temptation to add "check your work" loops or "generate N candidates and pick the best" is strong — both are intuitive and look rigorous. But the data says they cost more than they return at current model capability levels.

## Decision

We do not add verifier modules, evaluator loops, or multi-candidate search to the harness without first measuring their impact on a concrete task the setup handles.

"Measuring" means: run the same task N times with and without the module, compare completion rate and token cost. Gut feel, theoretical arguments, and "other teams do it" are not sufficient.

## Alternatives considered

- **Add a lightweight verifier anyway** — low cost, might catch regressions. Rejected because even lightweight verifiers showed negative impact in controlled experiments. The issue isn't cost; it's that models second-guess correct work.
- **Add multi-candidate search for hard tasks** — generate 3 approaches, pick the best. Rejected because 4x token cost for −2 to −6 points of accuracy is a bad trade. When models improve enough that candidate quality variance drops, the selection overhead dominates.
- **No policy at all** — let contributors add whatever they want. Rejected because cargo-culting "more verification = better" is the default instinct, and this ADR exists to force the data conversation before it happens.

## Consequences

### Good

- Prevents token waste on modules that hurt more than they help at current capability levels.
- Forces empirical validation before adding complexity.
- Keeps the harness in "craft of subtraction" posture — remove before you add.

### Bad / risky

- This decision encodes a snapshot of model capability (mid-2026). As models improve, verifiers may become net-positive. This ADR should be revisited when a new model generation ships.
- Contributors with positive verifier experience in other contexts may find this frustrating. The ADR should explain *why*, not just *what*.

## References

- "Natural-Language Agent Harnesses" (Tsinghua, March 2026) — ablation tables §4
- "Meta-Harness: End-to-End Optimization" (Stanford/Katab, March 2026) — harness-as-optimization-target
- Anthropic agent evolution blog post — GAN architecture cost analysis
- Vercel agent simplification — tool reduction results
