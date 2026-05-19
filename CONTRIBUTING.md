# Contributing to ChainNusa

Terima kasih atas minat berkontribusi ke ChainNusa!

## Cara Berkontribusi

### Bug Reports

Gunakan template bug report saat membuat issue. Sertakan:
- Versi Node.js dan pnpm
- Network/chain yang digunakan
- Langkah reproduksi yang jelas
- Error log lengkap

### Feature Requests

Gunakan template feature request. Jelaskan:
- Masalah yang ingin diselesaikan
- Alternatif yang sudah dipertimbangkan
- Dampak ke komponen existing (web, ml-service, contracts)

### Pull Requests

1. Fork repo dan buat branch dari `dev`
2. Ikuti [Conventional Commits](https://www.conventionalcommits.org/) — `feat:`, `fix:`, `test:`, `docs:`, `chore:`
3. TDD untuk perubahan kontrak (`forge test` sebelum implementasi)
4. Verifikasi sebelum PR:
   ```bash
   pnpm web:typecheck
   pnpm contracts:test
   ```
5. PR ke branch `dev`

### Development Setup

```bash
pnpm install
cp .env.example .env  # edit sesuai kebutuhan
pnpm dev
```

Lihat [README.md](./README.md) untuk setup lengkap.

### Code Style

- Solidity: ikuti [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- TypeScript: ESLint config sudah disediakan (`pnpm web:lint`)
- Python: Ruff (`pnpm ml:lint`)

### Commit Convention

```
feat: add MultiSigWallet with N-of-M threshold
fix: reentrancy guard on executeTransaction
test: add fuzz tests for owner management
docs: update provider matrix in README
chore: pin pnpm to v10 in Dockerfile
```
