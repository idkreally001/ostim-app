# Contributing to OstimOne

Thank you for your interest in contributing to OstimOne! This guide outlines how to propose bug fixes, new features, and improvements to the codebase.

---

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior to project maintainers.

---

## Development Setup

### Prerequisites

Ensure you have the following tools installed on your development machine:

* **Node.js**: v20 or later (v22 recommended)
* **Bun**: v1.1 or later (`curl -fsSL https://bun.sh/install | bash`)
* **Java Development Kit (JDK)**: OpenJDK 17
* **Android SDK**: Build-Tools 35.0.0+, Android SDK Platform 35
* **Git**: v2.30+

### Clone & Install

```bash
git clone https://github.com/idkreally001/ostim-app.git
cd ostim-app

# Install project dependencies
bun install
```

### Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env
```

Ensure `.env` contains valid testing credentials or runtime encryption keys if you intend to execute local device builds or run canary health checks.

---

## Development Workflow

### 1. Branching

Always create a descriptive topic branch off `main`:

```bash
git checkout -b feature/improved-attendance-card
# or
git checkout -b fix/alarm-scheduler-dedup
```

### 2. Verification & Type Checking

Before committing any changes, ensure all static analysis and bundle tests pass:

```bash
# TypeScript compiler check
bun run tsc --noEmit

# Test Metro JS bundling
npx expo export:embed --entry-file index.ts --platform android --dev false --bundle-output /tmp/test-bundle.js --assets-dest /tmp/test-assets
```

### 3. Commit Message Conventions

We adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

* `feat(...)`: A new feature (e.g., `feat(i18n): add Azerbaijani locale dictionary`)
* `fix(...)`: A bug fix (e.g., `fix(alarms): deduplicate consecutive lecture periods`)
* `docs(...)`: Documentation changes (e.g., `docs: update installation instructions`)
* `refactor(...)`: Code changes that neither fix a bug nor add a feature
* `perf(...)`: Performance optimization
* `chore(...)`: Routine tasks, dependency updates, version bumps

---

## Submitting Pull Requests

1. **Keep Pull Requests Focused**: Submit PRs with a single logical change. Avoid mixing unrelated refactors with functional changes.
2. **Follow Code Formatting**: Preserve existing indentation, styling hooks, and typing standards.
3. **Fill the PR Template**: Describe the motivation, changes made, and verification steps taken.

---

## Reporting Issues

* **Bug Reports**: Use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.yml). Include reproduction steps, device hardware/architecture (e.g., ARM64, x86_64), Android OS version, and sanitized diagnostic logs.
* **Feature Requests**: Use the [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.yml). Explain the problem statement, proposed solution, and practical benefit to students.

Thank you for helping make OstimOne better for all students!
