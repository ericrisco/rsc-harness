# Evals for the `django` skill

`cases.yaml` is a trigger/routing and capability rubric, not an automated test harness. Run it
by reading each prompt and checking the skill behaves: every `should_trigger` prompt should make
the `django` skill fire (including the non-obvious template-N+1 case and the Spanish phrasings),
and every `should_not_trigger` prompt should route to the named sibling (`fastapi`, `postgresdb`,
`security-audit`, `api-design`) instead. For the `capability` case, draft the answer and confirm it
hits every line in `must_include` — model with FK + Meta, explicit `ModelSerializer`, `ModelViewSet`
with `permission_classes`, owner-scoped `get_queryset` with `select_related`, router registration,
`perform_create` setting the owner, the `APIClient.force_authenticate` 403/200 test, and the
migration step. A miss on any line means the skill body or references need tightening.
