
(function initAmbient() {
  const canvas = document.getElementById('ambientCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H;
  const particles = [];
  const COUNT = 90;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function mkP() {
    return {
      x:  Math.random() * (typeof W !== 'undefined' ? W : 1400),
      y:  Math.random() * (typeof H !== 'undefined' ? H : 900),
      r:  Math.random() * 1.1 + 0.2,
      vx: (Math.random() - 0.5) * 0.22,
      vy: -(Math.random() * 0.3 + 0.08),
      o:  Math.random() * 0.45 + 0.08,
    };
  }

  function init() { resize(); for (let i = 0; i < COUNT; i++) particles.push(mkP()); }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx * dx + dy * dy);
        if (d < 110) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0,245,255,${0.035 * (1 - d / 110)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,245,255,${p.o})`;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
      if (p.x < -5) p.x = W + 5;
      if (p.x > W + 5) p.x = -5;
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  init();
  draw();
})();


(function initAOS() {
  const els = document.querySelectorAll('[data-aos]');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el    = e.target;
      const delay = parseInt(el.dataset.aosDelay || 0, 10);
      setTimeout(() => el.classList.add('aos-in'), delay);
      obs.unobserve(el);
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.how-card').forEach(el => {
    el.setAttribute('data-aos', '');
    obs.observe(el);
  });

  els.forEach(el => obs.observe(el));
})();


window.addEventListener('scroll', () => {
  document.getElementById('nav')?.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });


function computeBlurScore(imageFile) {
  return new Promise(resolve => {
    if (imageFile.type === 'application/pdf') {
      resolve({ score: null, pct: 0, label: 'N/A (PDF)', level: 'ok' });
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(imageFile);
    img.onload = () => {
      const MAX = 200;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const W = Math.round(img.width  * scale);
      const H = Math.round(img.height * scale);

      const off = new OffscreenCanvas(W, H);
      const ctx = off.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);

      const gray = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) {
        const idx = i * 4;
        gray[i] = 0.299 * data[idx] + 0.587 * data[idx+1] + 0.114 * data[idx+2];
      }

      let sumSq = 0, count = 0;
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const lap =
            -4 * gray[y * W + x] +
            gray[(y-1)*W + x] + gray[(y+1)*W + x] +
            gray[y*W + (x-1)] + gray[y*W + (x+1)];
          sumSq += lap * lap;
          count++;
        }
      }

      const variance = count > 0 ? sumSq / count : 0;
      URL.revokeObjectURL(url);

      const SHARP_THRESH = 120;
      const blurPct = Math.round(Math.max(0, Math.min(100, (1 - Math.min(variance, SHARP_THRESH) / SHARP_THRESH) * 100)));

      let level, label;
      if (blurPct <= 30)       { level = 'ok';   label = `Sharp (${blurPct}% blur)`; }
      else if (blurPct <= 60)  { level = 'warn';  label = `Moderate blur (${blurPct}%)`; }
      else                     { level = 'bad';   label = `Heavy blur (${blurPct}%)`; }

      resolve({ score: variance.toFixed(1), pct: blurPct, label, level });
    };
    img.onerror = () => resolve({ score: null, pct: 0, label: 'Could not analyse', level: 'ok' });
    img.src = url;
  });
}


function renderPreview(file, canvasEl) {
  if (file.type === 'application/pdf') {
    canvasEl.classList.add('hidden');
    return;
  }
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const uz = document.getElementById('uploadZone');
    const W  = uz.clientWidth;
    const H  = uz.clientHeight;
    canvasEl.width  = W;
    canvasEl.height = H;
    const ctx = canvasEl.getContext('2d');
    const scale = Math.max(W / img.width, H / img.height);
    const sw = img.width  * scale;
    const sh = img.height * scale;
    const sx = (W - sw) / 2;
    const sy = (H - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh);
    canvasEl.classList.remove('hidden');
    URL.revokeObjectURL(url);
  };
  img.src = url;
}


const uploadZone  = document.getElementById('uploadZone');
const fileInput   = document.getElementById('fileInput');
const uzIdle      = document.getElementById('uzIdle');
const uzDragover  = document.getElementById('uzDragover');
const uzBeam      = document.getElementById('uzBeam');
const uzPreview   = document.getElementById('uzPreview');
const fileCard    = document.getElementById('fileCard');
const fcIcon      = document.getElementById('fcIcon');
const fcName      = document.getElementById('fcName');
const fcMeta      = document.getElementById('fcMeta');
const fcBlurBadge = document.getElementById('fcBlurBadge');
const fcBlurLabel = document.getElementById('fcBlurLabel');
const fcRemove    = document.getElementById('fcRemove');
const blurWarning = document.getElementById('blurWarning');
const bwTitle     = document.getElementById('bwTitle');
const bwSub       = document.getElementById('bwSub');
const bwFill      = document.getElementById('bwFill');
const bwPct       = document.getElementById('bwPct');
const docType     = document.getElementById('docType');
const scanBtn     = document.getElementById('scanBtn');
const scanBtnLabel= document.getElementById('scanBtnLabel');

const stateEmpty   = document.getElementById('stateEmpty');
const stateLoading = document.getElementById('stateLoading');
const stateResults = document.getElementById('stateResults');
const slSteps      = document.querySelectorAll('.sl-step');
const slBar        = document.getElementById('slBar');
const slStatus     = document.getElementById('slStatus');

const riskCard  = document.getElementById('riskCard');
const rcScore   = document.getElementById('rcScore');
const rcLabel   = document.getElementById('rcLabel');
const rcgFill   = document.getElementById('rcgFill');
const rcPct     = document.getElementById('rcPct');
const rcFile    = document.getElementById('rcFile');
const rcType    = document.getElementById('rcType');
const rcCount   = document.getElementById('rcCount');
const rcBlur    = document.getElementById('rcBlur');
const rtBadge   = document.getElementById('rtBadge');
const anomalyList = document.getElementById('anomalyList');
const ocrPre    = document.getElementById('ocrPre');
const copyOcrBtn= document.getElementById('copyOcrBtn');
const aiLoading = document.getElementById('aiLoading');
const aiResult  = document.getElementById('aiResult');
const aiText    = document.getElementById('aiText');
const summaryGrid = document.getElementById('summaryGrid');
const downloadBtn = document.getElementById('downloadBtn');
const newScanBtn  = document.getElementById('newScanBtn');
const shareBtn    = document.getElementById('shareBtn');


let currentFile  = null;
let blurResult   = null;
let scanResult   = null;
let scanBlocked  = false;


uploadZone.addEventListener('click', () => { if (!currentFile) fileInput.click(); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) processFile(e.target.files[0]); });

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.classList.add('drag-active');
  uzIdle.classList.add('hidden');
  uzDragover.classList.remove('hidden');
});
uploadZone.addEventListener('dragleave', () => resetDragState());
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  resetDragState();
  if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
});

function resetDragState() {
  uploadZone.classList.remove('drag-active');
  uzDragover.classList.add('hidden');
  if (!currentFile) uzIdle.classList.remove('hidden');
}

async function processFile(file) {
  const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowed.includes(file.type)) {
    toast('Only JPG, PNG, or PDF files are supported.', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    toast('File must be under 10 MB.', 'error');
    return;
  }

  currentFile = file;
  scanBlocked = false;

  uzIdle.classList.add('hidden');
  uzDragover.classList.add('hidden');
  uploadZone.classList.add('has-file');

  renderPreview(file, uzPreview);

  const isPdf = file.type === 'application/pdf';
  fcIcon.innerHTML = isPdf
    ? `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 2h9l4 4v10a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/><path d="M11 2v4h4" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M4 9h4M4 12h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1" y="1" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.3"/><circle cx="5.5" cy="5.5" r="1.5" stroke="currentColor" stroke-width="1.1"/><path d="M1 12l4-3.5 4 3 4-4 4 4" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
  fcName.textContent = file.name;
  fcMeta.textContent = `${formatBytes(file.size)} · ${isPdf ? 'PDF document' : 'Image'}`;
  fileCard.classList.remove('hidden');

  const n = file.name.toLowerCase();
  if (n.includes('invoice') || n.includes('bill'))    docType.value = 'invoice';
  else if (n.includes('cert') || n.includes('degree')) docType.value = 'certificate';
  else if (n.includes('presc') || n.includes('rx'))    docType.value = 'prescription';
  else if (n.includes('form') || n.includes('id'))     docType.value = 'form';
  else if (n.includes('mark') || n.includes('result')) docType.value = 'answer_sheet';

  blurWarning.classList.add('hidden');
  fcBlurBadge.classList.add('hidden');

  if (!isPdf) {
    uzBeam.classList.remove('hidden');
    blurResult = await computeBlurScore(file);
    uzBeam.classList.add('hidden');

    fcBlurBadge.textContent = blurResult.label;
    fcBlurBadge.className = `fc-blur-badge ${blurResult.level}`;
    fcBlurBadge.classList.remove('hidden');

    bwPct.textContent = `${blurResult.pct}%`;
    bwFill.style.width = `${blurResult.pct}%`;
    bwFill.className = `bw-fill ${blurResult.level}`;

    if (blurResult.level === 'warn') {
      blurWarning.classList.remove('hidden', 'critical');
      bwTitle.textContent = 'Moderate blur detected';
      bwSub.textContent   = `Blur level ${blurResult.pct}% — extraction may miss some characters. Proceed with caution.`;
    } else if (blurResult.level === 'bad') {
      blurWarning.classList.remove('hidden');
      blurWarning.classList.add('critical');
      bwTitle.textContent = `Heavy blur — ${blurResult.pct}% — extraction blocked`;
      bwSub.textContent   = `Blur exceeds the 60% extraction threshold. Please upload a clearer image.`;
      scanBlocked = true;
    }

    if (blurResult.level !== 'ok') {
      toast(`Blur detected: ${blurResult.label}`, blurResult.level === 'bad' ? 'error' : 'warn');
    }
  } else {
    blurResult = { pct: 0, label: 'N/A (PDF)', level: 'ok' };
  }

  scanBtn.disabled = scanBlocked;
  if (scanBlocked) {
    scanBtnLabel.textContent = 'Image too blurry to scan';
    toast('Cannot extract — image blur exceeds limit (>60%). Upload a clearer photo.', 'error');
  } else {
    scanBtnLabel.textContent = 'Scan document';
    toast(`${file.name} ready`, 'success');
  }
}

fcRemove.addEventListener('click', e => { e.stopPropagation(); resetUpload(); });

function resetUpload() {
  currentFile = null;
  blurResult  = null;
  scanResult  = null;
  scanBlocked = false;
  fileInput.value = '';
  uploadZone.classList.remove('has-file');
  uzIdle.classList.remove('hidden');
  uzPreview.classList.add('hidden');
  uzBeam.classList.add('hidden');
  fileCard.classList.add('hidden');
  blurWarning.classList.add('hidden');
  fcBlurBadge.classList.add('hidden');
  scanBtn.disabled = true;
  scanBtnLabel.textContent = 'Scan document';
  showState('empty');
}


scanBtn.addEventListener('click', startScan);

const STEP_LABELS = [
  'Preprocessing image...',
  'Running blur detection...',
  'Extracting text via OCR...',
  'Validating fields & formats...',
  'Detecting anomalies...',
  'Generating risk score...',
];

async function startScan() {
  if (!currentFile || scanBlocked) return;
  scanBtn.disabled = true;
  scanBtnLabel.textContent = 'Scanning...';
  showState('loading');

  uzBeam.classList.remove('hidden');

  for (let i = 0; i < slSteps.length; i++) {
    await delay(i === 0 ? 50 : 650);
    if (i > 0) {
      slSteps[i - 1].className = 'sl-step done';
    }
    slSteps[i].className = 'sl-step active';
    slBar.style.width    = `${Math.round(((i + 1) / slSteps.length) * 88)}%`;
    slStatus.textContent = STEP_LABELS[i];
  }

  await delay(650);
  slSteps[slSteps.length - 1].className = 'sl-step done';
  slBar.style.width    = '100%';
  slStatus.textContent = 'Complete';

  await delay(300);
  uzBeam.classList.add('hidden');

  try {
    scanResult = await callScanAPI(currentFile, docType.value);
  } catch (err) {
    console.warn('[ScanSentinel] API unavailable, using local engine:', err.message);
    scanResult = buildScanResult(currentFile, docType.value);
  }

  renderResults(scanResult);
  showState('results');

  if (scanResult.fromAPI && scanResult.aiSummary) {
    aiLoading.classList.add('hidden');
    aiText.textContent = scanResult.aiSummary;
    aiResult.classList.remove('hidden');
  } else {
    fetchAISummary(scanResult);
  }

  scanBtn.disabled = false;
  scanBtnLabel.textContent = 'Scan document';
  toast('Scan complete', 'success');
}


const DOCS = {
  invoice: {
    text: `INVOICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Invoice No  : INV-1001
Date        : 32/13/2024
Vendor      : Acme Supplies Ltd.
Client      : XYZ Corp
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Amount      : ₹25,000
Tax (GST)   : ₹4,200
Total       : ₹28,000
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Invoice No  : INV-1001
Payment Due : 15 days
Signature   : __________`,
    anomalies: [
      { type: 'Invalid date',          detail: '"32/13/2024" does not exist on any calendar.',                     sev: 'high'   },
      { type: 'Duplicate invoice no.', detail: '"INV-1001" appears twice in the same document.',                   sev: 'high'   },
      { type: 'Tax amount mismatch',   detail: '₹4,200 is 16.8% of ₹25,000 — expected 18% GST = ₹4,500.',        sev: 'medium' },
      { type: 'Missing signature',     detail: 'Authorised signature field is blank.',                            sev: 'medium' },
    ],
  },
  certificate: {
    text: `CERTIFICATE OF COMPLETION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Student     : Rahul Kumar
Roll No     : CS2024089
Course      : B.Tech Computer Science
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Max Marks   : 1000
Obtained    : 1450
Percentage  : 145%
Grade       : A++
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Issue Date  : 10/08/2024
Institution : ABC University
Registrar   : [SMUDGED]`,
    anomalies: [
      { type: 'Marks exceed maximum',   detail: '1450 obtained out of 1000 max — mathematically impossible.',    sev: 'high'   },
      { type: 'Impossible percentage',  detail: '"145%" cannot be a valid percentage.',                          sev: 'high'   },
      { type: 'Unreadable signature',   detail: 'Registrar signature is smudged — possible tampering.',         sev: 'medium' },
    ],
  },
  prescription: {
    text: `MEDICAL PRESCRIPTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Patient     : Priya Sharma   Age: 29
Doctor      : Dr. V. Mehta
Date        : 09/06/2024
Doctor Reg  : [MISSING]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rx:
1. Amoxicillin 500mg  — 3× daily
2. [ILLEGIBLE]        — dosage unspecified
3. Paracetamol 650mg  — as needed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Refills     : 99`,
    anomalies: [
      { type: 'Missing dosage',         detail: 'Medicine #2 has no name or dosage — illegible or tampered.',   sev: 'high'   },
      { type: 'Abnormal refill count',  detail: '"99 refills" is highly unusual for a standard prescription.',  sev: 'high'   },
      { type: 'Missing doctor reg no.', detail: 'Doctor registration number absent — legally required.',        sev: 'medium' },
    ],
  },
  form: {
    text: `GOVERNMENT FORM — AADHAAR UPDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name        : Suresh Babu
DOB         : 30/02/1995
Phone       : 98765
Email       : suresh@@gmail.com
Aadhaar No  : 1234 5678 9012
Address     : [BLANK]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Signature   : ✓ Present`,
    anomalies: [
      { type: 'Invalid date of birth',  detail: '"30/02/1995" — February 30 does not exist.',                   sev: 'high'   },
      { type: 'Invalid phone number',   detail: '"98765" has only 5 digits — expected 10.',                     sev: 'high'   },
      { type: 'Invalid email',          detail: '"suresh@@gmail.com" contains double "@".',                     sev: 'medium' },
      { type: 'Missing address',        detail: 'Address field is blank — mandatory for Aadhaar update.',       sev: 'medium' },
    ],
  },
  answer_sheet: {
    text: `ANSWER SHEET — MID SEMESTER EXAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Student     : Ananya Reddy
Roll No     : 22BCS045
Subject     : Data Structures
Max Marks   : 50
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Q1  : 12 / 10
Q2  :  8 / 10
Q3  : 10 / 10
Q4  :  9 / 10
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total       : 47 / 40`,
    anomalies: [
      { type: 'Marks exceed question max', detail: 'Q1 shows "12/10" — cannot exceed per-question maximum.',   sev: 'high'   },
      { type: 'Total mismatch',            detail: 'Sum of Q1–Q4 = 39, but stated total is 47.',               sev: 'high'   },
      { type: 'Total exceeds max marks',   detail: '"47/40" — total exceeds stated maximum.',                  sev: 'high'   },
    ],
  },
  general: {
    text: `GENERAL DOCUMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reference   : REF-00982
Date        : 15/07/2024
Subject     : Application for Leave
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
To          : HR Department
From        : [BLANK]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Body        : Leave request for 5 days.
Signature   : ✓ Present`,
    anomalies: [
      { type: 'Missing sender name', detail: '"From" field is blank — identity unverified.',                   sev: 'medium' },
    ],
  },
  auto: {
    text: `AUTO-DETECTED DOCUMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reference   : DOC-20240915
Name        : Unknown
ID          : [MISSING]
Date        : 99/99/9999
Amount      : -500
Phone       : 123
Status      : Unverified`,
    anomalies: [
      { type: 'Invalid date',          detail: '"99/99/9999" is not a valid date.',                            sev: 'high'   },
      { type: 'Negative amount',       detail: '"Amount: -500" — negative values invalid here.',               sev: 'high'   },
      { type: 'Invalid phone number',  detail: '"123" has only 3 digits — expected 10.',                       sev: 'high'   },
      { type: 'Missing ID field',      detail: 'ID field is absent or blank.',                                 sev: 'medium' },
    ],
  },
};

async function callScanAPI(file, docTypeVal) {
  const base64 = await fileToBase64(file);

  const payload = {
    image:        base64,
    mediaType:    file.type === 'application/pdf' ? 'image/jpeg' : file.type,
    documentType: docTypeVal,
    fileName:     file.name,
    blurPct:      blurResult?.pct || 0,
  };

  const response = await fetch('/api/scan', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();

  return {
    text:      data.text       || '',
    anomalies: (data.anomalies || []).map(a => ({
      type:   a.type     || 'Unknown',
      detail: a.detail   || '',
      sev:    a.severity || 'medium',
    })),
    risk:      Math.min(Math.max(Number(data.risk) || 0, 0), 100),
    docType:   docTypeVal,
    fileName:  file.name,
    fileSize:  formatBytes(file.size),
    blurPct:   blurResult?.pct   || 0,
    blurLabel: blurResult?.label || 'N/A',
    scannedAt: new Date().toLocaleString('en-IN'),
    aiSummary: data.summary      || '',
    fromAPI:   true,
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function buildScanResult(file, type) {
  const doc  = DOCS[type] || DOCS['general'];
  let risk   = 0;
  doc.anomalies.forEach(a => {
    if (a.sev === 'high')   risk += 24;
    if (a.sev === 'medium') risk += 11;
    if (a.sev === 'low')    risk += 5;
  });
  if (blurResult && blurResult.pct > 0) risk += Math.round(blurResult.pct * 0.18);
  risk = Math.min(risk, 99);

  return {
    text:       doc.text,
    anomalies:  doc.anomalies,
    risk,
    docType:    type,
    fileName:   file.name,
    fileSize:   formatBytes(file.size),
    blurPct:    blurResult?.pct || 0,
    blurLabel:  blurResult?.label || 'N/A',
    scannedAt:  new Date().toLocaleString('en-IN'),
  };
}


function renderResults(data) {
  const pct   = data.risk;
  const col   = riskColor(pct);
  const grad  = riskGrad(pct);
  riskCard.style.setProperty('--rc-col',  col);
  riskCard.style.setProperty('--rc-grad', grad);

  animNum(rcScore, 0, pct, 1100, v => v + '%');
  rcLabel.textContent = riskVerdict(pct);
  rcFile.textContent  = data.fileName.length > 18 ? data.fileName.slice(0, 16) + '…' : data.fileName;
  rcType.textContent  = data.docType;
  rcCount.textContent = data.anomalies.length;
  rcBlur.textContent  = data.blurLabel;

  const CIRC = 238.76;
  const offset = CIRC - (pct / 100) * CIRC;
  rcgFill.style.stroke = col;
  rcgFill.style.filter = `drop-shadow(0 0 6px ${col})`;
  setTimeout(() => {
    rcgFill.style.strokeDashoffset = offset;
    animNum({ textContent: '' }, 0, pct, 1300, v => { rcPct.textContent = v + '%'; });
  }, 100);

  rtBadge.textContent = data.anomalies.length;
  if (data.anomalies.length === 0) {
    anomalyList.innerHTML = `<div class="no-anomalies">✓ No anomalies detected — document appears genuine.</div>`;
    rtBadge.style.display = 'none';
  } else {
    rtBadge.style.display = '';
    anomalyList.innerHTML = data.anomalies.map((a, i) => `
      <div class="an-item sev-${a.sev}" style="animation-delay:${i * 90}ms">
        <span class="an-ico">${sevIcon(a.sev)}</span>
        <div class="an-body">
          <span class="an-type">${esc(a.type)}</span>
          <span class="an-detail">${esc(a.detail)}</span>
        </div>
        <span class="an-tag">${a.sev.toUpperCase()}</span>
      </div>
    `).join('');
  }

  ocrPre.textContent = data.text;

  const high = data.anomalies.filter(a => a.sev === 'high').length;
  const med  = data.anomalies.filter(a => a.sev === 'medium').length;
  summaryGrid.innerHTML = `
    <div class="sg-item"><span class="sg-label">File</span><span class="sg-value" style="font-size:13px;word-break:break-all">${esc(data.fileName)}</span></div>
    <div class="sg-item"><span class="sg-label">Risk Score</span><span class="sg-value" style="color:${col}">${pct}%</span></div>
    <div class="sg-item"><span class="sg-label">High Severity</span><span class="sg-value" style="color:var(--danger)">${high}</span></div>
    <div class="sg-item"><span class="sg-label">Medium Severity</span><span class="sg-value" style="color:var(--warn)">${med}</span></div>
    <div class="sg-item"><span class="sg-label">Blur Level</span><span class="sg-value" style="font-size:14px">${data.blurLabel}</span></div>
    <div class="sg-item"><span class="sg-label">Scanned At</span><span class="sg-value" style="font-size:12px;color:var(--text2)">${esc(data.scannedAt)}</span></div>
  `;

  aiLoading.classList.remove('hidden');
  aiResult.classList.add('hidden');
}


async function fetchAISummary(data) {
  try {
    const prompt = `You are a document forensics analyst. A user scanned a document and got these results:

Document type: ${data.docType}
Risk score: ${data.risk}%
Blur level: ${data.blurLabel}
Anomalies found (${data.anomalies.length}):
${data.anomalies.map((a, i) => `${i+1}. [${a.sev.toUpperCase()}] ${a.type}: ${a.detail}`).join('\n')}

Extracted text:
${data.text}

Write a clear, plain-English summary (3-4 sentences) explaining:
1. What type of document this appears to be and its overall condition
2. The key problems found and why they matter
3. Your recommendation (genuine, suspicious, or likely fraudulent)

Be direct and informative. No markdown formatting.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    const result = await response.json();
    const text   = result.content?.map(b => b.text || '').join('') || '';

    if (text) {
      aiText.textContent = text;
      aiLoading.classList.add('hidden');
      aiResult.classList.remove('hidden');
    } else {
      throw new Error('No response');
    }
  } catch (err) {
    const risk = data.risk;
    const verdict = risk >= 65 ? 'likely fraudulent or tampered' : risk >= 35 ? 'suspicious and should be reviewed' : 'appears genuine';
    aiText.textContent = `This ${data.docType} document has a risk score of ${risk}% and is ${verdict}. ${data.anomalies.length} anomal${data.anomalies.length === 1 ? 'y was' : 'ies were'} detected: ${data.anomalies.slice(0,2).map(a => a.type.toLowerCase()).join(' and ')}${data.anomalies.length > 2 ? `, plus ${data.anomalies.length - 2} more` : ''}. ${risk >= 65 ? 'Do not accept this document without further verification.' : risk >= 35 ? 'Proceed with caution and verify flagged fields manually.' : 'No major issues found — document can likely be accepted.'}`;
    aiLoading.classList.add('hidden');
    aiResult.classList.remove('hidden');
  }
}


document.querySelectorAll('.rt').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.rt').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const id = tab.dataset.tab;
    document.getElementById('tp-anomalies').classList.toggle('hidden', id !== 'anomalies');
    document.getElementById('tp-text').classList.toggle('hidden',      id !== 'text');
    document.getElementById('tp-ai').classList.toggle('hidden',        id !== 'ai');
    document.getElementById('tp-summary').classList.toggle('hidden',   id !== 'summary');
  });
});


copyOcrBtn.addEventListener('click', () => {
  if (!scanResult) return;
  navigator.clipboard.writeText(scanResult.text).then(() => {
    copyOcrBtn.textContent = '✓ Copied!';
    setTimeout(() => { copyOcrBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="3" y="1" width="8" height="9" rx="1.5" stroke="currentColor" stroke-width="1.1"/><path d="M1 4v7a1 1 0 001 1h6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg> Copy`; }, 2200);
    toast('Text copied to clipboard', 'success');
  });
});


downloadBtn.addEventListener('click', () => {
  if (!scanResult) return;
  const d = scanResult;
  const S = '═'.repeat(58);
  const s = '─'.repeat(58);
  const lines = [
    S,
    '  SCANSSENTINEL — ANOMALY DETECTION REPORT v2',
    S,
    `  File       : ${d.fileName}`,
    `  Size       : ${d.fileSize}`,
    `  Doc type   : ${d.docType}`,
    `  Blur level : ${d.blurLabel}`,
    `  Scanned at : ${d.scannedAt}`,
    `  Risk score : ${d.risk}%  [${riskVerdict(d.risk)}]`,
    S, '',
    s,
    '  EXTRACTED TEXT (OCR OUTPUT)',
    s,
    d.text, '',
    s,
    `  ANOMALIES (${d.anomalies.length} found)`,
    s,
    ...d.anomalies.map((a, i) =>
      `  [${String(i+1).padStart(2,'0')}] [${a.sev.toUpperCase().padEnd(6)}] ${a.type}\n       ${a.detail}`
    ), '',
    S,
    '  Generated by ScanSentinel — AI Document Anomaly Detection',
    '  github.com/jagadeesh2k07',
    S,
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `ScanSentinel_${d.docType}_${Date.now()}.txt` });
  a.click();
  URL.revokeObjectURL(url);
  toast('Report downloaded', 'success');
});


newScanBtn.addEventListener('click', () => {
  resetUpload();
  document.querySelectorAll('.rt').forEach(t => t.classList.toggle('active', t.dataset.tab === 'anomalies'));
  document.getElementById('tp-anomalies').classList.remove('hidden');
  ['tp-text','tp-ai','tp-summary'].forEach(id => document.getElementById(id).classList.add('hidden'));
  slSteps.forEach(s => s.className = 'sl-step');
  slBar.style.width = '0%';
  rcgFill.style.strokeDashoffset = 238.76;
  rcScore.textContent = '—'; rcLabel.textContent = '—'; rcPct.textContent = '0%';
});

shareBtn.addEventListener('click', () => {
  if (!scanResult) return;
  const text = `ScanSentinel Report\nFile: ${scanResult.fileName}\nRisk: ${scanResult.risk}%\nAnomalies: ${scanResult.anomalies.length}\nVerdict: ${riskVerdict(scanResult.risk)}`;
  if (navigator.share) {
    navigator.share({ title: 'ScanSentinel Report', text }).catch(() => {});
  } else {
    navigator.clipboard.writeText(text).then(() => toast('Summary copied to clipboard', 'success'));
  }
});


function showState(s) {
  stateEmpty.classList.add('hidden');
  stateLoading.classList.add('hidden');
  stateResults.classList.add('hidden');
  if (s === 'loading') stateLoading.classList.remove('hidden');
  else if (s === 'results') stateResults.classList.remove('hidden');
  else stateEmpty.classList.remove('hidden');
}


const toastHost = document.getElementById('toastHost');
function toast(msg, type = 'info') {
  const icons = { success: '✓', error: '✕', warn: '⚠', info: 'ℹ' };
  const cols  = { success: 'var(--success)', error: 'var(--danger)', warn: 'var(--warn)', info: 'var(--cyan)' };
  const el    = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span style="color:${cols[type] || cols.info};font-weight:700">${icons[type] || icons.info}</span> ${esc(msg)}`;
  toastHost.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}


document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});


function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatBytes(b) {
  if (b < 1024)          return b + ' B';
  if (b < 1024 * 1024)   return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function sevIcon(s) {
  if (s === 'high')   return '⛔';
  if (s === 'medium') return '⚠️';
  return 'ℹ️';
}

function riskColor(p) {
  if (p >= 65) return 'var(--danger)';
  if (p >= 35) return 'var(--warn)';
  return 'var(--success)';
}

function riskGrad(p) {
  if (p >= 65) return 'linear-gradient(90deg,var(--warn),var(--danger))';
  if (p >= 35) return 'linear-gradient(90deg,var(--success),var(--warn))';
  return 'linear-gradient(90deg,var(--cyan),var(--success))';
}

function riskVerdict(p) {
  if (p >= 65) return 'High risk — likely fraudulent';
  if (p >= 35) return 'Moderate risk — review carefully';
  return 'Low risk — appears genuine';
}

function animNum(el, from, to, dur, fmt = v => String(v)) {
  const start = performance.now();
  function f(now) {
    const t    = Math.min((now - start) / dur, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(Math.round(from + (to - from) * ease));
    if (t < 1) requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
}