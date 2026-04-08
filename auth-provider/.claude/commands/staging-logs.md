# F3 Auth — Staging Logs

Query Cloud Run logs for the **f3-auth** staging deployment.

## Configuration

- **GCP Project:** `f3-authentication-staging`
- **Cloud Run Service:** `f3-auth`
- **Region:** `us-east1`
- **Staging URL:** `https://staging.auth2.f3nation.com`

## Instructions

When the user runs this command, fetch and display recent staging logs. Accept an optional argument for filtering.

### Argument Parsing

The user may provide arguments after the slash command. Parse them as follows:

- **No arguments** — show the 20 most recent log entries (all severities)
- **`errors`** — filter to `severity>=ERROR`
- **`warnings`** — filter to `severity>=WARNING`
- **`<number>`** (e.g. `50`) — show that many recent entries
- **`<minutes>m`** (e.g. `30m`) — show logs from the last N minutes
- **`<hours>h`** (e.g. `2h`) — show logs from the last N hours
- **Free-text filter** — pass as a gcloud logging filter (e.g. `httpRequest.status>=400`)

Arguments can be combined: `/staging-logs errors 50 30m`

### Execution

1. Build the gcloud command:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="f3-auth"<SEVERITY_FILTER><TIME_FILTER><CUSTOM_FILTER>' \
  --project=f3-authentication-staging \
  --limit=<LIMIT> \
  --format='json' \
  --freshness=<FRESHNESS>
```

2. Run the command and parse the JSON output.

3. Present a **summary table** to the user with these columns:
   - **Timestamp** (local time, human-readable)
   - **Severity** (color-coded if possible: ERROR=red, WARNING=yellow, INFO=default)
   - **Method + URL** (from `httpRequest.requestMethod` + `httpRequest.requestUrl`, or textPayload)
   - **Status** (from `httpRequest.status`)
   - **Latency** (from `httpRequest.latency`)
   - **Remote IP** (from `httpRequest.remoteIp`)

4. After the table, provide a brief **summary**:
   - Total entries shown
   - Count by severity
   - Any error patterns or repeated 4xx/5xx status codes
   - Notable user agents (bots vs real users)

5. If there are errors, offer to dig deeper into specific log entries by their `insertId`.

### Example Outputs

**`/staging-logs`** → "Here are the 20 most recent staging log entries for f3-auth..."

**`/staging-logs errors 1h`** → "Here are all ERROR-level logs from the last hour..."

**`/staging-logs httpRequest.status>=500`** → "Here are recent 5xx errors..."
