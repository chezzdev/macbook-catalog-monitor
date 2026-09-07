# MacBook catalog staging monitor

Hourly independent check of the public Cloudflare staging service and inventory,
exact-new-price and exchange-rate freshness. The workflow runs on GitHub's
standard Ubuntu runner. It makes no Apple requests and holds no Cloudflare token.

[Staging](https://macbook-catalog-staging.chezzdev.workers.dev/) ·
[Operations](https://macbook-catalog-staging.chezzdev.workers.dev/ops/) ·
[Workflow runs](https://github.com/chezzdev/macbook-catalog-monitor/actions/workflows/health.yml)

A failed check makes the workflow fail after three bounded attempts. GitHub's
notification delivery follows the owner's Actions notification settings. No
external email or messaging integration is configured.

`status.json` records the latest daily observation and each healthy/failed state
transition. Its Git history provides an operational record and keeps the public
repository active so GitHub does not disable its schedule after 60 idle days.
The scheduled check runs at minute 17, but GitHub may delay scheduled jobs.

Inventory may be at most three hours old; prices and FX at most 36 hours old.
`health/live` alone is insufficient to pass. The enabled market registry and
readiness response must agree. All recorded fields are already public health
metadata. No artifacts or caches are uploaded.

The reviewed source is maintained in the application's `staging/monitor/`
directory. Deploying the application does not silently rewrite this repository.
To stop this monitor, disable the workflow in GitHub Actions.
