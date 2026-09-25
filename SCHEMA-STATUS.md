# Schema status

- `schemas/oats-package.schema.json` and `schemas/capability-manifest.schema.json`
  are byte copies of `docs/` in [awebai/oats](https://github.com/awebai/oats) at
  `bdd7e55e1b798a97b8b5486001d7c17e522792a7`. CI (`npm test` → `scripts/validate-manifests.mjs`)
  validates the package and capability manifests against them.
- No lock schema is vendored: this repository writes no `oats-lock.json`. A
  consuming workspace's lock is the kernel's (`docs/oats-lock-v3.schema.json`).
