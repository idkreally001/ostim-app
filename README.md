# OstimOne

[![Release](https://img.shields.io/github/v/release/idkreally001/ostim-app?style=flat-square&color=2563eb)](https://github.com/idkreally001/ostim-app/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/idkreally001/ostim-app/build-apk.yml?branch=main&style=flat-square)](https://github.com/idkreally001/ostim-app/actions/workflows/build-apk.yml)
[![API Canary](https://img.shields.io/github/actions/workflow/status/idkreally001/ostim-app/api-canary.yml?branch=main&label=API%20Canary&style=flat-square)](https://github.com/idkreally001/ostim-app/actions/workflows/api-canary.yml)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Android%208.0+-3DDC84?style=flat-square&logo=android&logoColor=white)](https://github.com/idkreally001/ostim-app/releases)
[![Languages](https://img.shields.io/badge/Languages-7%20Locales-9333ea?style=flat-square)](src/locales/)

A high-performance, open-source, and client-side mobile client for OSTİM Technical University Student Information System (OBS) and LMS (Moodle).

Designed from the ground up to solve latency, unreliability, and lack of offline accessibility in the legacy portal, OstimOne provides students with an instant, private, and dependable academic dashboard.

---

## Features

### Academic Workflow
* **Offline-First Synchronization**: Timetable, student records, and grades are cached securely on-device. Lectures and classroom locations remain accessible in basement auditoriums and areas without cellular reception.
* **Full 7-Day Timetable**: Complete weekly view covering Monday through Sunday, supporting evening education, weekend lectures, and elective courses with live class status dots.
* **Next Class Intelligence**: The dashboard automatically identifies upcoming classes, counts down to lecture start times, and queries campus weather forecasts one hour prior to class.
* **Attendance Risk Monitoring**: Tracks theoretical and practical absence hours with color-coded warning indicators against university regulatory thresholds (75% rule).
* **"What-If" GPA (AGNO) Simulator**: Allows students to simulate cumulative and semester grade point averages before final or make-up exam results are officially announced.
* **LMS & Moodle Integration**: Unified session management for assignments, submission statuses, and course materials with automated re-login flow.

### System & Platform Integration
* **Native Android Alarms**: Uses Android's `AlarmManager.setExactAndAllowWhileIdle()` to schedule notifications matching lecture times. Alerts fire reliably even when the device is in battery-saving Doze mode or the application is closed.
* **Configurable Reminder Timing**: Offers quick presets (10, 15, 30, 45, 60 min) and custom duration selection (1–300 minutes).
* **Calendar & CSV Export**: Generates RFC 5545-compliant `.ics` calendar files with precise recurring day-of-week recurrence rules for Google Calendar, Apple Calendar, and Outlook, alongside spreadsheet-ready CSV tables.
* **Internationalization (i18n)**: Native, hand-crafted localization for **7 languages**:
  * Turkish (`tr`), English (`en`), Azerbaijani (`az`), Russian (`ru`), Arabic (`ar`, RTL), French (`fr`), and Persian (`fa`, RTL).
* **Material 3 Design**: Built using Google Material 3 tonal surface elevation, rounded surfaces (28dp dialog corners), dynamic dark and light theme palettes, and adaptive system navigation.

---

## Downloads

Official release packages are built and signed directly via GitHub Actions CI/CD.

| Asset | Target Architecture | Description |
| :--- | :--- | :--- |
| **`ostim-app-arm64-v8a.apk`** | 64-bit ARM (`arm64-v8a`) | **Recommended for modern phones** (~23 MB). Lowest binary footprint and optimal runtime performance. |
| **`ostim-app-armeabi-v7a.apk`** | 32-bit ARM (`armeabi-v7a`) | Compatibility release for older 32-bit Android devices (~18 MB). |
| **`ostim-app-universal.apk`** | Fat Binary (All ABIs) | Universal package bundling all native binaries (~70 MB). |

Download the latest signed release on the [GitHub Releases Page](https://github.com/idkreally001/ostim-app/releases/latest).

---

## Architecture & Privacy Model

OstimOne enforces a zero-knowledge, 100% client-to-server security architecture:

```
+-----------------------------------------------------------+
|                      Student Device                       |
|                                                           |
|       [ React Native / Expo Native Runtime ]              |
|       [ Native Kotlin AlarmManager & Notifications ]      |
|       [ Encrypted Local Storage (Tokens & Preferences) ]  |
+---------------------+-------------------------------+-----+
                      |                               |
       Direct TLS     |                  Direct TLS   |
                      v                               v
         +--------------------------+    +--------------------------+
         | obs.ostimteknik.edu.tr   |    | lmsclus.ostimteknik.edu.tr|
         | (University OBS API)     |    | (Moodle LMS Services)    |
         +--------------------------+    +--------------------------+
```

* **No Intermediate Servers**: Network requests originate directly from the student's device to official university servers via encrypted HTTPS. No analytics, tracking tokens, or user credentials ever pass through third-party servers.
* **Encrypted Remote Configuration**: University endpoint signatures and encryption keys are encrypted using AES-128 and distributed through `config.enc`. Configuration updates do not require compiling new binary releases.
* **Continuous Health Monitoring**: The `.github/workflows/api-canary.yml` automated workflow probes Proliz endpoints every 12 hours to verify upstream schema integrity and notify maintainers of potential university server disruptions.

---

## Development

### Prerequisites
* **Node.js**: v20 or later (v22 recommended)
* **Bun**: v1.1+
* **JDK**: OpenJDK 17
* **Android SDK**: Build-Tools 35+, Platform 35

### Quick Start

```bash
# Clone the repository
git clone https://github.com/idkreally001/ostim-app.git
cd ostim-app

# Install dependencies
bun install

# Configure environment variables
cp .env.example .env

# Start Metro bundler
bun start
```

### Verification Commands

```bash
# Static type checking
bun run tsc --noEmit

# Test JS asset bundling
npx expo export:embed --entry-file index.ts --platform android --dev false --bundle-output /tmp/test-bundle.js --assets-dest /tmp/test-assets

# Compile native Android release code
cd android && ./gradlew compileReleaseKotlin
```

---

## Community & Contributing

Contributions are welcome. Please read our governance documentation prior to submitting issues or pull requests:

* [Code of Conduct](CODE_OF_CONDUCT.md)
* [Contributing Guide](CONTRIBUTING.md)
* [Security Policy](SECURITY.md)

---

## Disclaimer

OstimOne is an independent, community-developed open-source project created by students. It is not an official product of, sponsored by, or affiliated with the administration of OSTİM Technical University. All university logos, course titles, and institutional names are property of their respective holders.

---

## License

This project is licensed under the [MIT License](LICENSE).
