const dropzone       = document.getElementById('dropzone');
const fileInput      = document.getElementById('fileInput');
const browseBtn      = document.getElementById('browseBtn');
const fileCard       = document.getElementById('fileCard');
const fileName       = document.getElementById('fileName');
const fileSize       = document.getElementById('fileSize');
const removeFile     = document.getElementById('removeFile');
const docType        = document.getElementById('docType');
const scanBtn        = document.getElementById('scanBtn');
const emptyState     = document.getElementById('emptyState');
const loadingState   = document.getElementById('loadingState');
const loadingBar     = document.getElementById('loadingBar');
const loadingSteps   = document.querySelectorAll('.loading-step');
const results        = document.getElementById('results');
const riskScore      = document.getElementById('riskScore');
const riskStatus     = document.getElementById('riskStatus');
const riskRingFill   = document.getElementById('riskRingFill');
const riskRingPct    = document.getElementById('riskRingPct');
const riskCard       = document.getElementById('riskCard');
const anomalyCount   = document.getElementById('anomalyCount');
const anomalyList    = document.getElementById('anomalyList');
const extractedText  = document.getElementById('extractedText');
const copyText       = document.getElementById('copyText');
const downloadReport = document.getElementById('downloadReport');
const rescan         = document.getElementById('rescan');

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

// ADVANCED AI VISION AGENT PIPELINE CONNECTIVITY
async function startScan() {
  if (!currentFile || scanBtn.disabled) return;

  scanBtn.disabled = true;
  showPanel('loading');
  loadingBar.style.width = '10%';

  setStepState(0, 'active');
  setStepState(1, 'waiting');
  setStepState(2, 'waiting');

  try {
    // 1. Convert user upload to base64 string so the AI vision agent can perceive pixels
    const base64Data = await convertToBase64(currentFile);
    
    loadingBar.style.width = '35%';
    setStepState(0, 'done');
    setStepState(1, 'active');

    // 2. Transmit contextual variables to your backend Cloud Worker Endpoint
    // Note: Swap this placeholder path with your absolute production live URL when ready
    const SERVERLESS_AI_URL = '/api/scan';
    
    const response = await fetch(SERVERLESS_AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Data,
        documentType: docType.value,
        fileName: currentFile.name
      })
    });

    if (!response.ok) throw new Error('Cloud Worker AI engine failure.');
    
    loadingBar.style.width = '85%';
    setStepState(1, 'done');
    setStepState(2, 'active');

    // 3. Capture the fully repaired text array layout object model straight from the agent
    scanResult = await response.json();

    loadingBar.style.width = '100%';
    setStepState(2, 'done');
    await delay(300);

    // Render results seamlessly back onto the UI layout components
    renderResults(scanResult);
    showPanel('results');

  } catch (error) {
    console.error("ScanSentinel Processing Error:", error);
    showToast('The AI Engine was unable to reconstruct the blurred segments.', 'error');
    resetResults();
  } finally {
    scanBtn.disabled = false;
  }
}

// Data Utility: Transforms upload binaries into cloud transmittable base64 blocks
function convertToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

function setStepState(index, state) {
  if (!loadingSteps[index]) return;
  if (state === 'done') loadingSteps[index].className = 'loading-step done';
  else if (state === 'active') loadingSteps[index].className = 'loading-step active';
  else loadingSteps[index].className = 'loading-step';
}

function renderResults(data) {
  extractedText.textContent = data.text;
  anomalyCount.textContent = data.anomalies ? data.anomalies.length : 0;
  
  if (!data.anomalies || data.anomalies.length === 0) {
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

  const pct = data.risk || 0;
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
  if (pct >= 60) return 'var(--danger)';
  if (pct >= 25) return 'var(--warn)';
  return 'var(--success)';
}

function riskLabel(pct) {
  if (pct >= 60) return '🔴 High risk — likely fraudulent or tampered';
  if (pct >= 25) return '🟡 Moderate risk — review carefully';
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
    `Document   : ${scanResult.docType ? scanResult.docType.toUpperCase() : 'UNKNOWN'}`,
    `Risk Score : ${scanResult.risk}%  (${riskLabel(scanResult.risk).replace(/^[^ ]+ /, '')})`,
    '',
    '-'.repeat(60),
    'EXTRACTED TEXT CONTENT',
    '-'.repeat(60),
    scanResult.text,
    '',
    '-'.repeat(60),
    `ANOMALIES DETECTED (${scanResult.anomalies ? scanResult.anomalies.length : 0})`,
    '-'.repeat(60),
    ...(scanResult.anomalies || []).map((a, i) =>
      `[${(i+1).toString().padStart(2,'0')}] [${a.severity.toUpperCase()}] ${a.type}\n     ${a.detail}`
    ),
    '',
    '='.repeat(60),
    'END OF REPORT — Generated via ScanSentinel AI Core Engine',
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
    pointer-events: none;
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
  return str.replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;')
            .replace(/'/g,'&#039;');
}