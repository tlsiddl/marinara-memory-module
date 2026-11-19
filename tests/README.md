# Isolated regression tests

Use Node.js 20 or newer (the current baseline used Node 26) and `sh` on PATH. On Windows, add Git's `bin` directory to PATH. From the repository root:

```sh
npm ci --prefix tests --ignore-scripts
npm run --prefix tests regression
```

The test-only lockfile pins happy-dom, Fastify and their transitive dependencies. The runner checks both packages and `sh` before running tests, then creates a disposable temporary data directory and runs every `test-*.cjs` and `test-*.mjs` except `test-macro.mjs`. It removes the temporary directory afterward. It does not install or alter production dependencies. Missing prerequisites fail with an explanation; they do not count as passing or skipped tests.

To install outside the checkout, copy `tests/package.json` and `tests/package-lock.json` into an empty disposable directory, run `npm ci --prefix <that-directory> --ignore-scripts`, and set `MEMORY_TEST_DEPS_DIR` to that directory's `node_modules` before running `node tests/run-regression.cjs`. `HAPPY_DOM_MODULE` and `NODE_PATH` are set for the child tests by the runner.

`test-macro.mjs` requires a built official Marinara engine and is run separately, together with the server E2Es, using `integration-isolated/README.md`. These tests use fake data and a fake model; browser and deployment environments are not covered by the regression runner.
