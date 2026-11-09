# Evals — gcp-essentials

`cases.yaml` drives two checks through the repo's standard eval harness. The
`should_trigger` / `should_not_trigger` prompts verify routing: each negative case
names the real sibling skill it should defer to (`aws-essentials`, `docker`,
`postgresdb`, `security-audit`, `vercel`) so the boundary is graded, not assumed. The
`capability` case is graded by an LLM judge against its `must_include` rubric — there
are no live GCP calls and nothing is deployed; the judge reads the produced gcloud
commands and checks that they are least-privilege, keyless, private-by-default, and
include a cost/teardown note. Run it the same way as every other skill in this repo
(point the harness at this directory); inspect any rubric miss by hand before trusting
the score.
