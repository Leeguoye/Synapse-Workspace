# Synapse — Hybrid War Room Platform

<p align="center">
    <picture>
        <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/your-username/synapse/main/assets/logo-light.svg">
        <img src="src/assets/desktopIcon.svg" alt="Synapse" width="500">
    </picture>
</p>

<p align="center">
  <strong>Visual No-Code / Low-Code Automation Engine for Google Workspace.</strong>
</p>

<p align="center">
  <a href="#english">English</a> • <a href="#traditional-chinese">繁體中文</a>
</p>

<p align="center">
  <a href="https://github.com/your-username/synapse/releases"><img src="https://img.shields.io/github/v/release/your-username/synapse?include_prereleases&style=for-the-badge&color=blue" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="MIT License"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&style=for-the-badge" alt="React 19"></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-40-47848F?logo=electron&style=for-the-badge" alt="Electron 40"></a>
</p>

---

<a id="english"></a>
## 🇺🇸 English

**Synapse** is a desktop-grade "Hybrid War Room Platform". It bridges the gap between raw data and actionable insights by integrating **Google Workspace**, local databases, and **Python scripts** through a high-performance visual workflow engine.

### 📥 Download & Install
To get started with Synapse, download the latest installer for your operating system (Windows/macOS/Linux) from our **[Releases Page](https://github.com/your-username/synapse/releases)**.

### 🚀 Key Highlights
- **Visual Programming Pipeline** — An "infinite canvas" workflow editor with dual-mode architecture: **Logic Mode** for developers and **Presentation Mode** for clean dashboard display.
- **Triggers & Scheduling** — Built-in `CronJob` support for automated tasks.
- **BYOK Credential Security** — Local `AES-256-GCM` encryption for Google OAuth tokens and API keys.
- **Virtual File System (VFS)** — Seamless integration with Google Drive and logic-linked views.
- **Plugin SDK** — Extensible architecture with sandboxed Node.js `vm` execution.

### 🛠 Development (From Source)
If you wish to contribute or build from source:
```bash
git clone [https://github.com/your-username/synapse.git](https://github.com/your-username/synapse.git)
pnpm install
pnpm dev
