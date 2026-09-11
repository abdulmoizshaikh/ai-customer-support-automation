---
description: Run lint + test verification
agent: build
---

Run the full verification pipeline in order:

1. Lint:
```
npm run lint
```

2. Unit tests:
```
npm run test
```

Report combined results. If lint fails, stop and show errors. If lint passes, run tests.
