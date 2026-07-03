// Locate UI Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const scanBtn = document.getElementById('scanBtn');
const documentTypeSelect = document.getElementById('documentType');

let base64ImageString = "";
let uploadedFileName = "";

// Handle file selections and convert to Base64 cleanly
function processFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Please drop or upload a valid image file.');
    return;
  }
  uploadedFileName = file.name;
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => {
    // Keep only the raw base64 data stream string
    base64ImageString = reader.result.split(',')[1];
    dropzone.innerHTML = `<p style="color: #10b981; font-weight: bold;">✓ ${file.name} ready for scanning</p>`;
    scanBtn.disabled = false;
  };
}

// Dropzone click & drag event configurations
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => processFile(e.target.files[0]));
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = '#3b82f6'; });
dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = '#cbd5e1'; });
dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.style.borderColor = '#cbd5e1'; processFile(e.dataTransfer.files[0]); });

// Trigger Core Backend Scanning Request
scanBtn.addEventListener('click', async () => {
  if (!base64ImageString) return;

  scanBtn.disabled = true;
  scanBtn.innerText = "Scanning Document...";

  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64ImageString,
        documentType: documentTypeSelect.value,
        fileName: uploadedFileName
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details || data.error || 'Server processing error');
    }

    // UPDATE UI DASHBOARD METRICS WITH RESULTS
    document.getElementById('extractedText').innerText = data.text || "No legible text recovered.";
    document.getElementById('riskScore').innerText = `${data.risk || 0}%`;
    
    // Dynamically build out anomaly alerts listing layout
    const anomalyContainer = document.getElementById('anomaliesList');
    anomalyContainer.innerHTML = "";

    if (data.anomalies && data.anomalies.length > 0) {
      data.anomalies.forEach(item => {
        const itemBlock = document.createElement('div');
        itemBlock.className = `anomaly-card severity-${item.severity || 'low'}`;
        itemBlock.innerHTML = `
          <h4>${item.type} <span class="badge">${item.severity.toUpperCase()}</span></h4>
          <p>${item.detail}</p>
        `;
        anomalyContainer.appendChild(itemBlock);
      });
    } else {
      anomalyContainer.innerHTML = `<p style="color: #64748b;">No security anomalies detected inside layout.</p>`;
    }

  } catch (err) {
    alert(`Scanning Sequence Paused: ${err.message}`);
    console.error(err);
  } finally {
    scanBtn.disabled = false;
    scanBtn.innerText = "Scan Document";
  }
});
