# F3 Auth — Cloud Run Logs

Query Cloud Run logs for the **f3-auth** deployment.

## Environment Map

| Environment | GCP Project                 | URL                                  |
| ----------- | --------------------------- | ------------------------------------ |
| `staging`   | `f3-authentication-staging` | `https://staging.auth2.f3nation.com` |
| `prod`      | `f3-authentication`         | `https://auth2.f3nation.com`         |

- **Cloud Run Service:** `f3-auth` (same in both environments)
- **Region:** `us-east1`

## Instructions

When the user runs this command, fetch and display recent Cloud Run logs. The first positional argument selects the environment. Default to **staging** if omitted.

### Argument Parsing

Parse arguments in any order:

| Argument            | Example                         | Effect                                  |
| ------------------- | ------------------------------- | --------------------------------------- |
| `staging` or `prod` | `/logs prod`                    | Select environment (default: `staging`) |
| `errors`            | `/logs errors`                  | Filter to `severity>=ERROR`             |
| `warnings`          | `/logs warnings`                | Filter to `severity>=WARNING`           |
| A bare number       | `/logs 50`                      | Limit to N entries (default: 20)        |
| `<N>m`              | `/logs 30m`                     | Logs from last N minutes                |
| `<N>h`              | `/logs 2h`                      | Logs from last N hours                  |
| `<N>d`              | `/logs 1d`                      | Logs from last N days                   |
| Anything else       | `/logs httpRequest.status>=400` | Passed as a custom gcloud filter        |

Arguments can be combined freely: `/logs prod errors 50 30m`

### Execution

1. Resolve the GCP project ID from the environment map above.

2. Build the gcloud command:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="f3-auth"<SEVERITY_FILTER><TIME_FILTER><CUSTOM_FILTER>' \
  --project=<PROJECT_ID> \
  --limit=<LIMIT> \
  --format='json' \
  --freshness=<FRESHNESS>
```

3. Run the command and parse the JSON output.

4. Present a **summary table** to the user with these columns:
   - **Timestamp** (local time, human-readable)
   - **Severity** (color-coded if possible: ERROR=red, WARNING=yellow, INFO=default)
   - **Method + URL** (from `httpRequest.requestMethod` + `httpRequest.requestUrl`, or textPayload)
   - **Status** (from `httpRequest.status`)
   - **Latency** (from `httpRequest.latency`)
   - **Remote IP** (from `httpRequest.remoteIp`)

5. After the table, provide a brief **summary**:
   - Total entries shown
   - Count by severity
   - Any error patterns or repeated 4xx/5xx status codes
   - Notable user agents (bots vs real users)

6. If there are errors, offer to dig deeper into specific log entries by their `insertId`.

### Examples

- **`/logs`** → 20 most recent staging entries
- **`/logs prod`** → 20 most recent prod entries
- **`/logs errors 1h`** → Staging errors from the last hour
- **`/logs prod errors 50 30m`** → 50 prod errors from the last 30 minutes
- **`/logs httpRequest.status>=500`** → Staging 5xx errors
