# Contributing to ChainNusa

Thanks for your interest in contributing!

## How to Contribute

### Bug Reports

Use the bug report template when creating an issue. Include:
- Node.js and pnpm versions
- Network/chain used
- Clear reproduction steps
- Full error log

### Feature Requests

Use the feature request template. Describe:
- The problem you want to solve
- Alternatives you've considered
- Impact on existing components (web, ml-service, contracts)

### Pull Requests

1. Fork the repo and create a branch from `dev`
2. Follow [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `test:`, `docs:`, `chore:`
3. TDD for contract changes (`forge test` before implementation)
4. Verify before PR:
   ```bash
   pnpm web:typecheck
   pnpm contracts:test
   ```
5. PR to `dev` branch

### Development Setup

```bash
pnpm install
cp .env.example .env  # edit as needed
pnpm dev
```

See [README.md](./README.md) for full setup instructions.

### Code Style

- Solidity: follow the [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- TypeScript: ESLint config provided (`pnpm web:lint`)
- Python: Ruff (`pnpm ml:lint`)

### Commit Convention

```
feat: add MultiSigWallet with N-of-M threshold
fix: reentrancy guard on executeTransaction
test: add fuzz tests for owner management
docs: update provider matrix in README
chore: pin pnpm to v10 in Dockerfile
```
