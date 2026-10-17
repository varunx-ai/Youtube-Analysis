# Sync the UI to your Mac and GitHub

1. Download and unzip this package.
2. In Terminal, open your existing `Youtube-Analysis` checkout (or clone `https://github.com/varunx-ai/Youtube-Analysis.git`).
3. Back up existing files/commits, if any. Copy the package contents into the repository root.
4. Run `corepack enable`, `corepack pnpm install`, `corepack pnpm typecheck`, `corepack pnpm dev`.
5. Visit `http://localhost:3000`; verify the four tabs, source drawer and save/reload behavior.
6. When satisfied, `git add . && git commit -m "feat: add Channel Scout research workspace UI" && git push origin main`.

This archive does not automatically change your remote GitHub repository or local Mac.
