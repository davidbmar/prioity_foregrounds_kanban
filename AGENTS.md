# Agent contract

This repository contains only the standalone Priority Foregrounds Kanban.

Before changing behavior:

1. Read `README.md` and the existing tests.
2. Preserve the exact 100-point budget and `0.1` principle floor.
3. Keep principle reordering on slider release, not during pointer movement.
4. Treat model output as an all-or-nothing proposal. Never partially apply it.
5. Render model and operator text with safe DOM text APIs.
6. Keep AI re-scoring default-off and bounded by rate, daily-run, and token limits.
7. Never commit `.env`, API keys, customer data, or generated provider output.
8. Run `python3 -m unittest discover -s tests -v` before committing.

The local server is not production authentication. Any public deployment needs
TLS, authentication, durable shared budgets, persistent storage, and an
external rate limiter.
