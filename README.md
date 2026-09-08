🌟 TK5 Web Bluetooth Health Dashboard (TP制作🐈)
A custom, web-based control panel designed for TK5 series smart health bracelets/rings, utilizing the Web Bluetooth API for real-time communication, health tracking, and local data extraction.
🚀 Key Features
 * Seamless Bluetooth Integration: Quick device pairing, service discovery (c1/c3 characteristics), automatic time calibration, and baseline sync.
 * Real-time Health Monitoring: Instantly trigger and monitor live measurements for:
   * ❤️ Heart Rate (data-mode="0")
   * 🩸 Blood Pressure (data-mode="1")
   * 💧 SpO2 / Blood Oxygen (data-mode="2")
   * ⚡ HRV (data-mode="10")
 * Comprehensive History Syncing: Pull internal device storage blocks via custom binary frame commands, including:
   * Sleep History (0x0504) & Step History (0x0502)
   * Heart Rate, Blood Pressure, SpO2, and Body Temperature history logs.
 * Data Management & Export:
   * Export all synced health records locally into a structured JSON file for offline analysis.
   * Real-time debugging terminal with raw hex packet logs and a one-click copy tool.
 * Polished Dark UI/UX:
   * Responsive grid layout with a sleek dark theme.
   * Interactive feedback featuring visual button glows and synthesized sound effects (Web Audio API).
   * Canvas-based trend visualization for historical metrics.
🛠️ Protocol & Technical Highlights
 * Communication: Direct browser-to-device interaction over Web Bluetooth, bypassing native mobile apps.
 * Frame Structure: Custom binary frame parsing with CRC16 validation for reliable command dispatch (e.g., status codes like 0xfe and data keys like 0x010d).
 * Local Storage: Persists captured health metrics safely in browser storage (tk5Records) for easy querying and backup.
🕹️ Quick Start
 * Open index.html in a Web Bluetooth-compatible browser (such as Google Chrome or Microsoft Edge on Desktop/Android).
 * Click the 连接 (Connect) button to scan and pair your TK5 device.
 * Once connected, use the interface to check real-time stats, run targeted measurements, or sync historical data.
 * Click 导出JSON (Export JSON) anytime to download your health database for custom analysis.
