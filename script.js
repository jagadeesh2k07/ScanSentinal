
const dropzone      = document.getElementById('dropzone');
const fileInput     = document.getElementById('fileInput');
const browseBtn     = document.getElementById('browseBtn');
const fileCard      = document.getElementById('fileCard');
const fileName      = document.getElementById('fileName');
const fileSize      = document.getElementById('fileSize');
const removeFile    = document.getElementById('removeFile');
const docType       = document.getElementById('docType');
const scanBtn       = document.getElementById('scanBtn');
const emptyState    = document.getElementById('emptyState');
const loadingState  = document.getElementById('loadingState');
const loadingBar    = document.getElementById('loadingBar');
const loadingSteps  = document.querySelectorAll('.loading-step');
const results       = document.getElementById('results');
const riskScore     = document.getElementById('riskScore');
const riskStatus    = document.getElementById('riskStatus');
const riskRingFill  = document.getElementById('riskRingFill');
const riskRingPct   = document.getElementById('riskRingPct');
const riskCard      = document.getElementById('riskCard');
const anomalyCount  = document.getElementById('anomalyCount');
const anomalyList   = document.getElementById('anomalyList');
const extractedText = document.getElementById('extractedText');
const copyText      = document.getElementById('copyText');
const downloadReport= document.getElementById('downloadReport');
const rescan        = document.getElementById('rescan');

let currentFile = null;
let scanResult  = null;

browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

dropzone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('drag-over');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

function handleFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    showToast('Only JPG, PNG, or PDF files are supported.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('File must be under 10 MB.', 'error');
    return;
  }

  currentFile = file;
  fileName.textContent = file.name;
  fileSize.textContent = formatBytes(file.size);
  fileCard.classList.remove('hidden');
  scanBtn.disabled = false;

  const name = file.name.toLowerCase();
  if (name.includes('invoice') || name.includes('bill')) docType.value = 'invoice';
  else if (name.includes('cert') || name.includes('degree')) docType.value = 'certificate';
  else if (name.includes('prescription') || name.includes('rx')) docType.value = 'prescription';
  else if (name.includes('form') || name.includes('id')) docType.value = 'form';
  else if (name.includes('mark') || name.includes('result')) docType.value = 'answer_sheet';
}

removeFile.addEventListener('click', (e) => {
  e.stopPropagation();
  resetFile();
});

function resetFile() {
  currentFile = null;
  fileInput.value = '';
  fileCard.classList.add('hidden');
  scanBtn.disabled = true;
  resetResults();
}

scanBtn.addEventListener('click', startScan);

async function startScan() {
  if (!currentFile) return;

  scanBtn.disabled = true;
  showPanel('loading');

  const totalSteps = loadingSteps.length;
  let currentStep = 0;

  const progressInterval = setInterval(() => {
    const pct = Math.round(((currentStep + 1) / totalSteps) * 100);
    loadingBar.style.width = pct + '%';

    loadingSteps.forEach((s, i) => {
      if (i < currentStep) { s.className = 'loading-step done'; }
      else if (i === currentStep) { s.className = 'loading-step active'; }
      else { s.className = 'loading-step'; }
    });

    currentStep++;
    if (currentStep >= totalSteps) clearInterval(progressInterval);
  }, 600);

  await delay(totalSteps * 600 + 400);

  clearInterval(progressInterval);
  loadingSteps.forEach(s => s.className = 'loading-step done');
  loadingBar.style.width = '100%';

  scanResult = simulateScan(currentFile, docType.value);

  await delay(300);
  renderResults(scanResult);
  showPanel('results');
  scanBtn.disabled = false;
}

function simulateScan(file, type) {
  const samples = {
    invoice: {
      text: `INVOICE

Invoice No : INV-1001
Date       : 32/13/2024
Vendor     : Acme Supplies Ltd.
Client     : XYZ Corp
Amount     : ₹ 25,000
Tax        : ₹ 4,200
Total      : ₹ 28,000

Payment Due : 15 days
Invoice No  : INV-1001

Authorized Signature : __________`,
      anomalies: [
        { type: 'Invalid date format', detail: 'Date "32/13/2024" is not a valid calendar date.', severity: 'high' },
        { type: 'Duplicate invoice number', detail: '"INV-1001" appears twice in the document.', severity: 'high' },
        { type: 'Tax mismatch', detail: '₹4,200 tax on ₹25,000 is 16.8% — expected 18% GST (₹4,500).', severity: 'medium' },
        { type: 'Missing signature', detail: 'Authorized signature field is blank.', severity: 'medium' },
      ],
    },
    certificate: {
      text: `CERTIFICATE OF COMPLETION

Student Name : Rahul Kumar
Roll No      : CS2024089
Course       : B.Tech Computer Science
Marks Obtained : 1450 / 1000
Percentage   : 145%
Grade        : A++

Issue Date   : 10/08/2024
Institution  : ABC University

Registrar Signature : [SMUDGED]`,
      anomalies: [
        { type: 'Impossible value — marks', detail: '"1450 / 1000" exceeds the maximum possible marks.', severity: 'high' },
        { type: 'Impossible value — percentage', detail: '"145%" exceeds 100%.', severity: 'high' },
        { type: 'Unreadable signature', detail: 'Registrar signature area appears smudged or tampered.', severity: 'medium' },
      ],
    },
    prescription: {
      text: `MEDICAL PRESCRIPTION

Patient   : Priya Sharma
Age       : 29
Doctor    : Dr. V. Mehta
Date      : 09/06/2024

Rx:
1. Amoxicillin 500mg  — 3x daily
2. [ILLEGIBLE]        — dosage unspecified
3. Paracetamol 650mg  — as needed

Refills   : 99
Doctor Reg No : [MISSING]`,
      anomalies: [
        { type: 'Missing dosage', detail: 'Medicine #2 has no dosage or name — likely tampered or incomplete.', severity: 'high' },
        { type: 'Unusual refill count', detail: '"99 refills" is abnormally high for a standard prescription.', severity: 'high' },
        { type: 'Missing doctor registration', detail: 'Doctor registration number is absent — legally required.', severity: 'medium' },
      ],
    },
    form: {
      text: `GOVERNMENT FORM — AADHAAR UPDATE

Name       : Suresh Babu
DOB        : 30/02/1995
Phone      : 98765
Email      : suresh@@gmail.com
Aadhaar No : 1234 5678 9012
Address    : [BLANK]

Declaration: I hereby declare...

Signature  : ✓ Present`,
      anomalies: [
        { type: 'Invalid date of birth', detail: '"30/02/1995" — February 30 does not exist.', severity: 'high' },
        { type: 'Invalid phone number', detail: '"98765" has only 5 digits; expected 10.', severity: 'high' },
        { type: 'Invalid email format', detail: '"suresh@@gmail.com" contains double "@".', severity: 'medium' },
        { type: 'Missing address', detail: 'Address field is blank — required field.', severity: 'medium' },
      ],
    },
    answer_sheet: {
      text: `ANSWER SHEET — MID SEMESTER EXAM

Student   : Ananya Reddy
Roll No   : 22BCS045
Subject   : Data Structures
Max Marks : 50

Q1  : 12 / 10
Q2  : 8  / 10
Q3  : 10 / 10
Q4  : 9  / 10
Total : 47 / 40`,
      anomalies: [
        { type: 'Marks exceed maximum', detail: 'Q1 shows "12/10" — cannot exceed question maximum.', severity: 'high' },
        { type: 'Total mismatch', detail: 'Sum of question marks (39) does not match stated total (47).', severity: 'high' },
        { type: 'Total exceeds maximum', detail: 'Total "47/40" exceeds stated maximum marks.', severity: 'high' },
      ],
    },
    general: {
      text: `GENERAL DOCUMENT

Reference  : REF-00982
Date       : 15/07/2024
Subject    : Application for Leave

To         : HR Department
From       : Employee — [BLANK]

Body       : I request 5 days of leave from 20/07/2024.

Phone      : 9876543210
Email      : user@company.com

Signature  : ✓ Present`,
      anomalies: [
        { type: 'Missing sender name', detail: '"From" field employee name is blank.', severity: 'medium' },
      ],
    },
    auto: {
      text: `DOCUMENT SCAN

Reference  : DOC-20240915
Name       : Unknown
ID         : [MISSING]
Date       : 99/99/9999
Amount     : -500
Phone      : 123

Status     : Unverified`,
      anomalies: [
        { type: 'Invalid date', detail: '"99/99/9999" is not a real date.', severity: 'high' },
        { type: 'Negative amount', detail: '"Amount: -500" — negative values are not valid here.', severity: 'high' },
        { type: 'Invalid phone number', detail: '"123" has only 3 digits; expected 10.', severity: 'high' },
        { type: 'Missing ID field', detail: 'ID field is absent or blank.', severity: 'medium' },
      ],
    },
  };

  const selected = samples[type] || samples['general'];

  let risk = 0;
  selected.anomalies.forEach(a => {
    if (a.severity === 'high')   risk += 25;
    if (a.severity === 'medium') risk += 12;
    if (a.severity === 'low')    risk += 5;
  });
  risk = Math.min(risk, 100);

  return {
    text:      selected.text,
    anomalies: selected.anomalies,
    risk,
    docType:   type,
    fileName:  file.name,
    scannedAt: new Date().toLocaleString(),
  };
}

function renderResults(data) {
  extractedText.textContent = data.text;

  anomalyCount.textContent = data.anomalies.length;
  if (data.anomalies.length === 0) {
    anomalyList.innerHTML = `<div class="no-anomalies">✓ No anomalies detected — document appears clean.</div>`;
    anomalyCount.className = 'badge badge-success';
  } else {
    anomalyCount.className = 'badge badge-danger';
    anomalyList.innerHTML = data.anomalies.map(a => `
      <div class="anomaly-item severity-${a.severity}">
        <span class="anomaly-icon">${severityIcon(a.severity)}</span>
        <div class="anomaly-content">
          <span class="anomaly-type">${escHtml(a.type)}</span>
          <span class="anomaly-detail">${escHtml(a.detail)}</span>
        </div>
        <span class="severity-tag">${a.severity.toUpperCase()}</span>
      </div>
    `).join('');
  }

  const pct  = data.risk;
  const color = riskColor(pct);
  riskCard.style.setProperty('--risk-color', color);
  riskScore.textContent = pct + '%';
  riskRingPct.textContent = pct + '%';
  riskStatus.textContent = riskLabel(pct);

  const circumference = 251.2;
  const offset = circumference - (pct / 100) * circumference;
  requestAnimationFrame(() => {
    riskRingFill.style.stroke = color;
    riskRingFill.style.strokeDashoffset = offset;
  });
}

function riskColor(pct) {
  if (pct >= 70) return 'var(--danger)';
  if (pct >= 40) return 'var(--warn)';
  return 'var(--success)';
}

function riskLabel(pct) {
  if (pct >= 70) return '🔴 High risk — likely fraudulent or tampered';
  if (pct >= 40) return '🟡 Moderate risk — review carefully';
  return '🟢 Low risk — document appears genuine';
}

function severityIcon(s) {
  if (s === 'high')   return '⛔';
  if (s === 'medium') return '⚠️';
  return 'ℹ️';
}

function showPanel(panel) {
  emptyState.classList.add('hidden');
  loadingState.classList.add('hidden');
  results.classList.add('hidden');
  if (panel === 'loading') loadingState.classList.remove('hidden');
  else if (panel === 'results') results.classList.remove('hidden');
  else emptyState.classList.remove('hidden');
}

function resetResults() {
  showPanel('empty');
  loadingBar.style.width = '0%';
  loadingSteps.forEach(s => s.className = 'loading-step');
  scanResult = null;
}

copyText.addEventListener('click', () => {
  if (!scanResult) return;
  navigator.clipboard.writeText(scanResult.text).then(() => {
    copyText.textContent = '✓ Copied';
    setTimeout(() => { copyText.innerHTML = `<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="4" y="1" width="9" height="11" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M2 4v9a2 2 0 002 2h6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> Copy`; }, 2000);
  });
});

downloadReport.addEventListener('click', () => {
  if (!scanResult) return;

  const lines = [
    '='.repeat(60),
    'SCANSSENTINEL — ANOMALY DETECTION REPORT',
    '='.repeat(60),
    `File       : ${scanResult.fileName}`,
    `Scanned at : ${scanResult.scannedAt}`,
    `Document   : ${scanResult.docType}`,
    `Risk Score : ${scanResult.risk}%  (${riskLabel(scanResult.risk).replace(/^[^ ]+ /, '')})`,
    '',
    '-'.repeat(60),
    'EXTRACTED TEXT',
    '-'.repeat(60),
    scanResult.text,
    '',
    '-'.repeat(60),
    `ANOMALIES DETECTED (${scanResult.anomalies.length})`,
    '-'.repeat(60),
    ...scanResult.anomalies.map((a, i) =>
      `[${(i+1).toString().padStart(2,'0')}] [${a.severity.toUpperCase()}] ${a.type}\n     ${a.detail}`
    ),
    '',
    '='.repeat(60),
    'END OF REPORT — Generated by ScanSentinel',
    '='.repeat(60),
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ScanSentinel_Report_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

rescan.addEventListener('click', () => {
  resetResults();
  showPanel('empty');
});

function showToast(msg, type = 'info') {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 9999;
    background: ${type === 'error' ? 'var(--danger-dim)' : 'var(--slate-3)'};
    color: ${type === 'error' ? 'var(--danger-text)' : 'var(--text)'};
    border: 1px solid ${type === 'error' ? 'var(--danger)' : 'var(--border-2)'};
    border-radius: 8px; padding: 12px 16px; font-size: 13px;
    font-family: var(--font-ui); box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    animation: slideUp 0.2s ease;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}