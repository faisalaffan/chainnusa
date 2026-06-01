# Git Crypt

Repo ini menggunakan [git-crypt](https://github.com/AGWA/git-crypt) untuk melindungi dokumen internal (`docs/internal/`).

## Cara kerja

File di `docs/internal/` otomatis terenkripsi saat commit. Di GitHub, isinya tampil sebagai binary. Hanya collaborator dengan GPG key terdaftar yang bisa baca.

File di luar `docs/internal/` tetap plain text normal — semua orang bisa baca.

## Rules

Rule enkripsi didefinisikan di `.gitattributes`:

```
docs/internal/** filter=git-crypt diff=git-crypt
.git-crypt/keys/** filter=git-crypt diff=git-crypt
```

## Setup untuk collaborator

### Prasyarat

```bash
brew install git-crypt
```

### Unlock (GPG)

```bash
# Setelah clone, cukup jalankan:
git-crypt unlock
```

Pastikan GPG key kamu sudah terdaftar sebagai collaborator oleh repo owner.

### Verifikasi

```bash
git-crypt status
# docs/internal/ → encrypted
```

## Setup untuk repo owner (menambah collaborator)

```bash
# 1. Collaborator export GPG public key
gpg --armor --export [email] > pubkey.asc

# 2. Owner import key
gpg --import pubkey.asc

# 3. Owner daftarin key
git-crypt add-gpg-user [KEY_ID]

# 4. Commit perubahan di .git-crypt/
git add .git-crypt/ && git commit -m "chore: add collaborator GPG key"
```

## Symmetric key backup

Jika belum pakai GPG, gunakan symmetric key yang sudah diexport:

```bash
# Unlock dengan symmetric key
git-crypt unlock /path/to/chainnusa-gitcrypt.key
```

Key backup tersimpan di `.git-crypt/keys/default/chainnusa-gitcrypt.key` (terenkripsi juga via git-crypt).

## File yang TIDAK dilindungi git-crypt

| File | Alasan |
|---|---|
| `.env` | Gitignored — tidak pernah commit |
| `*.secret`, `*.key` | Gitignored — tidak pernah commit |
| Private key GPG | Tidak pernah di repo |
