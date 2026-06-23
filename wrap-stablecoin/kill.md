# Stop local validator

```bash
anchor run stop-local
```

Same as `anchor run local-stop`. Optional: wipe ledger with `anchor run stop-local -- --reset`.

Manual fallback (default RPC port `8901`):

```bash
kill -9 $(lsof -ti:8901)
```
