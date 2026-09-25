# GitHub Actions CI/CD Setup Guide for VPS

This guide explains how to set up GitHub Actions to automatically deploy your project to your VPS server whenever you push changes to the `main` branch.

---

## 1. GitHub Repository Secrets Setup

Go to your GitHub Repository:
**Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ Click **New repository secret**

Add the following 4 secrets:

| Secret Name | Description | Example Value |
| :--- | :--- | :--- |
| `VPS_HOST` | Your VPS IP Address or Domain | `123.45.67.89` or `dandyapp.tech` |
| `VPS_USERNAME` | Linux username used for deployment | `root` or `ubuntu` |
| `VPS_SSH_KEY` | Private SSH Key content (`id_rsa` or `id_ed25519`) | `-----BEGIN OPENSSH PRIVATE KEY----- ...` |
| `VPS_PORT` | SSH Port (default is 22) | `22` |

*(Optional)*:
- `VPS_APP_DIR`: Path to project directory on VPS (defaults to `/var/www/market-visit`).
- `VPS_PASSPHRASE`: If your private key is encrypted with a passphrase.

---

## 2. Generating or Setting up SSH Key on VPS

If you don't already have an SSH key set up for GitHub Actions:

### Step A: Generate an SSH Key on your local machine or VPS
```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy_key
```
*(Press Enter when prompted for passphrase unless you want one)*

### Step B: Add the Public Key to `authorized_keys` on your VPS
```bash
cat ~/.ssh/github_deploy_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

### Step C: Copy the Private Key to GitHub Secrets
View your private key:
```bash
cat ~/.ssh/github_deploy_key
```
Copy the **entire output** (including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`) and paste it into GitHub Secret `VPS_SSH_KEY`.

---

## 3. Verify VPS Git Permissions

On your VPS, make sure Git recognizes the safe directory and doesn't ask for password on `git fetch`/`git pull`:

```bash
cd /var/www/market-visit
git config --global --add safe.directory /var/www/market-visit
```

---

## 4. How the Deployment Works

Every time you run:
```bash
git add .
git commit -m "update message"
git push origin main
```

1. GitHub Actions starts automatically.
2. Connects to your VPS via secure SSH.
3. Pulls latest changes from `main`.
4. Installs dependencies (`npm install`).
5. Builds the production bundle (`npm run build`).
6. Reloads PM2 seamlessly with `--update-env`.
