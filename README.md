# SQL Formatter ⚡

A modern, fast, and feature-rich desktop application for formatting SQL queries, extracting parameters, and substituting runtime values in real-time. Built with **Tauri v2**, **React 19**, and **Tailwind CSS**.

---

## ✨ Features

- 🔍 **Parameter Extraction & Live Substitution**:
  - Automatically parses and detects parameters (such as `@p0, @p1`, `$1, $2`, `DECLARE` blocks, and `sp_executesql` definitions).
  - Edit parameter values inline with real-time substitution in the formatted output.
  - Interactive parameter hovering & focus highlighting.
- 🗄️ **Multi-Dialect Support**:
  - **T-SQL / MS SQL Server** (including `sp_executesql`, batch statements, and variables).
  - **PostgreSQL** (dollar placeholders `$1`, type casts, and PG keywords).
- 🧹 **SQL Comment Handling**:
  - Toggle between preserving comments or stripping them cleanly without breaking string literals or identifiers.
- 🎨 **Customizable Formatting**:
  - Adjustable indentation / tab width (2 or 4 spaces).
  - Configurable keyword casing (`UPPERCASE` or `lowercase`).
  - Logical operator positioning (`AND`/`OR` placed before or after newlines).
- 📐 **Flexible Layout**:
  - Switch between **Vertical** (side-by-side) and **Horizontal** (stacked) split views.
- 🕒 **Query History**:
  - Automatically saves formatted queries locally with dialect, parameters, and timestamps.
  - Search, filter, restore, copy, or delete previous queries.
- 📋 **Seamless Clipboard Integration**:
  - Global `Cmd+V` / `Ctrl+V` shortcut automatically appends copied queries into the input editor.
  - One-click copy for clean formatted queries.
- 📊 **Real-time Performance Stats**:
  - Displays parse/format time in milliseconds, character reduction percentage, and parameter counts.

---

## 🛠️ Tech Stack

- **Framework**: [Tauri v2](https://tauri.app/) (Rust backend for lightweight native desktop performance)
- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 7](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons & Animations**: [Lucide React](https://lucide.dev/) & [Motion](https://motion.dev/)
- **SQL Parser**: Custom tokenizer + [`sql-formatter`](https://github.com/sql-formatter-org/sql-formatter)
- **Testing**: [Vitest](https://vitest.dev/)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+ recommended)
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- Platform-specific Tauri prerequisites (see [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/))

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/vlevshits/SqlFormatter.git
   cd SqlFormatter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the frontend only in the browser:
```bash
npm run dev
```

Run the full desktop app with Tauri:
```bash
npm run tauri dev
```

### Running Tests

Run the Vitest test suite:
```bash
npm test
```

---

## 📦 Building for Production

To build the desktop bundle for your current platform:

```bash
npm run tauri build
```

The output installers and binaries will be located in:
- macOS: `src-tauri/target/release/bundle/dmg/` or `bundle/macos/`
- Windows: `src-tauri/target/release/bundle/msi/` or `bundle/nsis/`

---

## 🤖 CI / CD & Releases

The project includes automated GitHub Actions workflows:

- **CI Check** (`.github/workflows/ci.yml`): Runs on every push/pull request to `main`, validating tests and TypeScript build.
- **Release** (`.github/workflows/release.yml`): Triggers on version tags (e.g. `v1.0.2`), building:
  - **macOS Universal Binary** (`aarch64-apple-darwin` + `x86_64-apple-darwin`) with Apple Developer ID code signing & notarization.
  - **Windows x64** installer.

---

## 📄 License

MIT © [Valiantsin Leushyts](https://github.com/vlevshits)
