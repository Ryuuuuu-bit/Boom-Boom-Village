# UAT status

UAT (https://game-uat.up.railway.app) was paused on 2026-11-21.

The Railway service `game` (environment `uat`) has its Start Command set to a command that exits right away,
with restart policy NEVER and no healthcheck, so nothing serves the game. The service and the Postgres
database (with all saves and accounts) are kept.

To turn UAT back on, in Railway open the `game` service in the `uat` environment, then Settings:
1. Start Command: clear it (or set `npm start`).
2. Healthcheck Path: `/health`.
3. Restart Policy: On Failure.
4. Deploy the latest commit (or push to main).
