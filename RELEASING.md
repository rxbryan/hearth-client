# Releasing

Releases are published manually, from a maintainer's machine, with `npm publish`.
There is no CI publish step.

This is fine because the package doesn't release often, and it also limits exposure to  supply-chain attacks since no publish token sits in CI to be leaked.

## Release steps

1. Confirm `main` is green in CI.
2. Bump the version. This updates `package.json` and creates a git tag. npm
   versions are immutable, a published version can never be replaced, so only
   bump when you intend to publish.
   ```bash
   npm version patch   # or minor / major
   ```
3. Inspect exactly what will ship. The `prepublishOnly` script rebuilds and runs
   the tests first. Confirm the tarball contains only `dist/`, `README.md`,
   `LICENSE`, and `package.json`.
   ```bash
   npm publish --dry-run
   ```
4. Publish. 2FA will prompt if enabled for writes.
   ```bash
   npm publish
   ```
5. Push the tag.
   ```bash
   git push --follow-tags
   ```
6. Verify.
   ```bash
   npm view hearth-client
   ```
