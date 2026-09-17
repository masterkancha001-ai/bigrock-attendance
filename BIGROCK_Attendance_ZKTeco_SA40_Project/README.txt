# BIGROCK Attendance — Complete Local Project

## Files
- index.html — application UI
- style.css — responsive design
- script.js — camera, attendance logic, IndexedDB storage, reports and backup

## Run
1. Put all 3 files in the same folder.
2. For camera access, use a local server rather than opening index.html directly.
3. In the project folder, run one of:
   - Windows: `py -m http.server 8000`
   - Or VS Code Live Server.
4. Open `http://localhost:8000`
5. Allow camera permission.
6. Add staff from Staff.
7. Go to Attendance, select employee, Start Camera, Capture, then mark Duty IN / OUT, Lunch and Break.

## Excel
The Export buttons create `.csv` files. Excel opens CSV directly. This avoids external libraries and keeps the project fully offline/local.

## Local storage
Attendance is saved in the browser's IndexedDB database. Use Settings → Download JSON Backup regularly.

## Important fingerprint note
A browser page cannot universally connect directly to a fingerprint terminal. The exact device model/protocol is required. This project is structured so a future fingerprint connector/API can insert the same attendance events into the `events` store. Send the fingerprint device brand/model (or a photo of its label) for integration work.

## Break rule
Default maximum total break is 60 minutes. Lunch + all completed/open breaks are combined. When total exceeds the configured limit, the employee is highlighted red on the dashboard.

## Duty rule
Default target is 12 hours. Duty time is calculated from Duty IN to Duty OUT, or to the current time while still working.


## ZKTeco BioPro SA40 Integration

The BioPro SA40 officially supports TCP/IP, Wi-Fi, RS232/485 and ADMS; the device also lists a standalone SDK. The included connector uses the ZK TCP/IP protocol through `node-zklib`, with the standard ZK port set to 4370.

### Setup
1. Connect the SA40 and the office PC/server to the same LAN.
2. On the SA40, open Communication/Ethernet and note its IP address. Keep the device on a fixed/reserved LAN IP.
3. Put the `server` folder next to the website files.
4. Install Node.js 18+.
5. Open a terminal inside `server` and run:
   `npm install`
6. Start:
   `npm start`
7. Open:
   `http://localhost:8000`
8. Open **Fingerprint** in BIGROCK Attendance, enter the SA40 IP, port 4370, and Comm Key if configured.
9. Test Connection, then Sync Attendance.

### Important mapping
The SA40's fingerprint transaction contains a device User ID. BIGROCK maps that value to the employee's **Employee ID**. Therefore, for automatic mapping, make the Employee ID in BIGROCK exactly the same as the User ID/PIN registered in the SA40.

### What is automatic
- Reads attendance logs from the SA40.
- Imports fingerprint scans into BIGROCK.
- First fingerprint punch for a day/session is treated as Duty IN.
- Next fingerprint punch is treated as Duty OUT.
- Duplicate scans are ignored.
- Dashboard and Excel reports update after sync.

### Lunch and breaks
A door fingerprint reader normally gives a punch/transaction, not necessarily the semantic meaning "Lunch OUT" or "Break IN". For reliable lunch/break classification, use BIGROCK's Lunch/Break buttons or configure the device's work-code/status functions if the installed firmware and configuration support them. Do not assume every SA40 firmware exposes the same work-code behavior.

### Network note
Port 4370 is the standard ZK device TCP port used by the connector. If the office network blocks it, allow TCP 4370 between the attendance PC/server and the SA40. Do not expose the biometric device directly to the public internet; keep it on the office LAN/VPN.

### ADMS option
The SA40 also lists ADMS support. For a cloud/remote deployment, an ADMS push connector can be used instead of LAN polling. That requires a reachable server endpoint and appropriate device configuration.
