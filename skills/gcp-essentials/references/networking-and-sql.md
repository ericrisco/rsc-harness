# Networking & Cloud SQL

Depth for the Cloud SQL and VPC parts of SKILL.md.

## Cloud Run egress: Direct VPC egress, not the legacy connector

To reach private IPs (a Cloud SQL private instance, an internal service) from Cloud
Run, prefer **Direct VPC egress** over the older Serverless VPC Access connector —
fewer moving parts, lower latency, no connector VM to size or pay for.

```bash
gcloud run deploy api --region=europe-west1 \
  --service-account=api-sa@acme-prod.iam.gserviceaccount.com \
  --network=projects/acme-prod/global/networks/default \
  --subnet=projects/acme-prod/regions/europe-west1/subnetworks/default \
  --vpc-egress=all-traffic
```

- `--vpc-egress=all-traffic` routes all outbound through the VPC. The value `all` is a
  deprecated alias — write `all-traffic`.
- `--vpc-egress=private-ranges-only` sends only RFC-1918 traffic through the VPC and
  lets public traffic exit directly — use it when only the DB is private.

The Serverless VPC Access connector (`--vpc-connector`) works but is not the
recommendation for new work; do not provision a new connector for greenfield work.

## Cloud SQL private IP

Disable the public IP and give the instance a private address on your VPC. This is the
single biggest attack-surface reduction for a database.

```bash
# One-time: allocate a range and peer it (Service Networking)
gcloud compute addresses create google-managed-services-default \
  --global --purpose=VPC_PEERING --prefix-length=16 \
  --network=projects/acme-prod/global/networks/default
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-default \
  --network=default --project=acme-prod

# Create the instance with private IP, no public IP.
# --edition=ENTERPRISE is required: POSTGRES_16+ defaults to Enterprise Plus, which
# cannot run the shared-core db-f1-micro tier, so the create fails without it.
gcloud sql instances create acme-db \
  --database-version=POSTGRES_16 --edition=ENTERPRISE \
  --region=europe-west1 --tier=db-f1-micro \
  --no-assign-ip \
  --network=projects/acme-prod/global/networks/default
```

PSC (Private Service Connect) is the alternative when you need the instance reachable
from multiple VPCs or projects; enable it with `--enable-private-service-connect` and
allow the consumer projects.

## Cloud SQL Auth Proxy (for outside-VPC connections)

The proxy gives short-lived client certs and TLS 1.3 without managing certificates. Use
it for **local dev** or any non-serverless host — Cloud Run does **not** need it (it
uses the `/cloudsql/...` socket via `--add-cloudsql-instances`).

```bash
# Local dev against a private-IP instance over the proxy
./cloud-sql-proxy --private-ip acme-prod:europe-west1:acme-db
# then connect your client to 127.0.0.1:5432
```

## Connection pooling

Cloud SQL has a hard `max_connections` ceiling and Cloud Run can fan out to many
instances, each opening its own pool — you will exhaust connections under load. Keep
each instance's pool small (e.g. a few connections) and, for high concurrency, front
the database with a pooler (PgBouncer / a managed proxy) rather than raising
`max_connections`. Schema and query tuning beyond this is `postgresdb` territory.
