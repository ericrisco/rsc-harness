# OIDC cloud deploys (AWS / GCP / Azure)

The goal: a deploy job assumes a cloud identity with **no stored long-lived keys**. GitHub mints a short-lived OIDC JWT for the run; the cloud provider validates it against a trust you configured and hands back a token scoped to that job for minutes. The job needs `permissions: id-token: write`.

The recurring footgun across all three clouds is an **over-permissioned trust**: scoping it to `repo:ORG/*` (any repo in the org) instead of one repo + ref. Always pin the `sub` claim down to repo + ref, and for prod down to environment.

## The OIDC `sub` claim — scope it tight

GitHub puts the run's identity in the JWT `sub`. The cloud trust matches on it. Pick the narrowest that still works:

| `sub` value | Grants to | Use for |
| --- | --- | --- |
| `repo:ORG/REPO:ref:refs/heads/main` | only `main` of one repo | branch deploys |
| `repo:ORG/REPO:ref:refs/tags/v*` | tag pushes of one repo | release deploys |
| `repo:ORG/REPO:environment:production` | the `production` environment of one repo | gated prod deploys (preferred) |
| `repo:ORG/*` | **any repo in the org** | almost never — this is the footgun |

Scoping to `environment:production` is strongest: the deploy only works from a job that names that environment, and the environment carries the required-reviewer gate.

## AWS — IAM role + `configure-aws-credentials`

One-time setup: create an IAM OIDC identity provider for `token.actions.githubusercontent.com`, then a role whose trust policy matches the `sub`.

```json
{
  "Effect": "Allow",
  "Principal": { "Federated": "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com" },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:ORG/REPO:environment:production"
    }
  }
}
```

In the workflow:

```yaml
permissions:
  id-token: write
  contents: read
steps:
  - uses: aws-actions/configure-aws-credentials@<full-40-char-sha>  # pin it
    with:
      role-to-assume: arn:aws:iam::123456789012:role/gh-deploy
      aws-region: eu-west-1
```

## GCP — Workload Identity Federation

Create a Workload Identity Pool + provider mapping `assertion.sub` to a principal, bind it to a service account.

```yaml
permissions:
  id-token: write
  contents: read
steps:
  - uses: google-github-actions/auth@<full-40-char-sha>
    with:
      workload_identity_provider: projects/123/locations/global/workloadIdentityPools/gh/providers/gh
      service_account: gh-deploy@my-project.iam.gserviceaccount.com
```

Add an attribute condition on the provider so only your repo + ref can mint a token:
`assertion.sub == 'repo:ORG/REPO:ref:refs/heads/main'`.

## Azure — federated credentials

On the app registration, add a federated credential with issuer `https://token.actions.githubusercontent.com`, subject `repo:ORG/REPO:environment:production`, audience `api://AzureADTokenExchange`.

```yaml
permissions:
  id-token: write
  contents: read
steps:
  - uses: azure/login@<full-40-char-sha>
    with:
      client-id: ${{ vars.AZURE_CLIENT_ID }}
      tenant-id: ${{ vars.AZURE_TENANT_ID }}
      subscription-id: ${{ vars.AZURE_SUBSCRIPTION_ID }}
```

`client-id`/`tenant-id`/`subscription-id` are identifiers, not secrets — keep them in `vars`, not `secrets`.

## Full deploy-on-tag workflow with environment approval

```yaml
name: Release
on:
  push:
    tags: ["v*"]

permissions:
  contents: read

concurrency:
  group: release-production
  cancel-in-progress: false      # never interrupt a release

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with: { node-version: 24, cache: npm }
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v7
        with: { name: dist, path: dist/ }

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production        # required-reviewer gate; pauses here for approval
    permissions:
      id-token: write              # OIDC; no static keys
      contents: read
    steps:
      - uses: actions/download-artifact@v8
        with: { name: dist, path: dist/ }
      - uses: aws-actions/configure-aws-credentials@<full-40-char-sha>
        with:
          role-to-assume: arn:aws:iam::123456789012:role/gh-deploy
          aws-region: eu-west-1
      - run: aws s3 sync dist/ s3://my-bucket --delete
```

The `environment: production` line is what makes GitHub pause for a reviewer before the deploy job starts — configure the required reviewers on the environment in repo settings, not in YAML.
