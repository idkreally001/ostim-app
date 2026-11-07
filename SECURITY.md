# Security Policy

## Supported Versions

Security updates and critical patches are actively applied to the latest minor version release.

| Version | Supported          |
| ------- | ------------------ |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :x:                |
| < 1.1.0 | :x:                |

---

## Zero-Knowledge Architecture & Privacy Model

OstimOne operates on a strict **zero-knowledge, 100% client-side** privacy architecture:

1. **No Intermediate Proxy Servers**:
   The application communicates directly between the student's mobile device and university endpoints (`obs.ostimteknik.edu.tr` and `lmsclus.ostimteknik.edu.tr`) over authenticated TLS connections. There are no backend middleware or logging proxies operated by project maintainers.
2. **Local Credential Storage**:
   Student passwords, authentication JWTs, and Moodle session cookies are stored exclusively within the device's sandboxed local application storage (`EncryptedSharedPreferences` / `AsyncStorage`).
3. **Encrypted Remote Configuration**:
   Runtime configuration parameters (including API secrets and university endpoints) are encrypted using AES-128 and distributed via `config.enc`. Decryption occurs strictly on-device using build-time master keys.

---

## Reporting a Vulnerability

If you discover a security vulnerability or potential credential exposure risk within OstimOne, please report it responsibly:

* **Do not open public GitHub issues for sensitive security vulnerabilities.**
* Please draft a private report via **GitHub Security Advisories** on the repository page:
  `https://github.com/idkreally001/ostim-app/security/advisories/new`
* Alternatively, contact repository maintainers directly via email or private channels.

### Report Details

Please include as much of the following information as possible:
* Type of vulnerability (e.g., token leakage, insecure cryptographic implementation, intent hijacking).
* Step-by-step instructions or proof of concept to reproduce the issue.
* Potential impact and proposed remediation, if known.

We will acknowledge receipt within 48 hours and work with you to test and release an expedited patch before any public disclosure.
