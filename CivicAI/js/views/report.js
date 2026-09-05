/**
 * CIVICAI: Report Issue Wizard (5-Step AI-Powered Pipeline)
 * "See an Issue. Capture It. Let AI Understand It. Report It. Track It. Resolve It."
 * STRICT CITIZEN AUTHENTICATION REQUIRED
 */

import { CIVIC_TAXONOMY, SEVERITY_LEVELS } from '../config.js';
import { AIVisionService } from '../ai-vision-service.js';
import { LocationService } from '../location-service.js';
import { db } from '../storage-db.js';
import { uploadImageToSupabase } from '../supabase-client.js';
import { auth } from '../auth-service.js';
import { notificationService } from '../notification-service.js';

export async function renderReport(container, navigateTo, params = {}) {
  // STRICT AUTHENTICATION CHECK: Only signed-in citizens can file a report
  if (!auth.isLoggedIn()) {
    renderAuthRequiredPrompt(container, navigateTo, params);
    return;
  }

  // Wizard State
  let currentStep = 1;
  let reportData = {
    imageFile: null,
    imageDataUrl: null,
    aiResult: null,
    category: params.preselectedCategory || 'Roads & Transportation',
    subcategory: '',
    title: '',
    description: '',
    severity: 'Medium',
    location: '',
    landmark: '',
    latitude: 28.6139,
    longitude: 77.2090,
    category_metadata: {},
    submittedReport: null
  };

  let mapInstance = null;

  function updateWizardUI() {
    container.querySelectorAll('.wizard-step-item').forEach(el => {
      const stepNum = parseInt(el.dataset.step, 10);
      el.classList.remove('active', 'completed');
      if (stepNum === currentStep) el.classList.add('active');
      else if (stepNum < currentStep) el.classList.add('completed');
    });

    container.querySelectorAll('.wizard-step-panel').forEach(panel => {
      const panelStep = parseInt(panel.dataset.step, 10);
      if (panelStep === currentStep) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    if (currentStep === 4 && !mapInstance) {
      setTimeout(() => {
        initLocationMap();
      }, 100);
    }

    if (currentStep === 5) {
      renderReviewStep();
    }
  }

  const currentUser = auth.getUser();

  container.innerHTML = `
    <div class="container section-sm" style="max-width: 860px;">
      
      <!-- Verified Citizen Banner -->
      <div style="display: flex; align-items: center; justify-content: space-between; background: #f0fdfa; border: 1px solid #ccfbf1; padding: 0.6rem 1rem; border-radius: var(--radius-md); margin-bottom: 1.5rem; font-size: 0.85rem;">
        <div style="color: #0f766e; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-circle-check" style="color: #10b981;"></i>
          <span>Filing as verified citizen: <strong>${currentUser?.full_name || 'Citizen'}</strong> (${currentUser?.email})</span>
        </div>
        <span class="badge badge-confidence-high" style="font-size: 0.75rem;">Verified Account</span>
      </div>

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 2rem;">
        <h1 style="font-size: 2.25rem; margin-bottom: 0.5rem;">Report a Civic Issue</h1>
        <p style="color: var(--neutral-600); font-size: 1.05rem;">
          Capture the problem, let AI assist in diagnosis, and submit directly to municipal authorities.
        </p>
      </div>

      <!-- 5-Step Wizard Progress Bar -->
      <div class="wizard-progress">
        <div class="wizard-step-item active" data-step="1">
          <div class="wizard-step-circle">1</div>
          <div class="wizard-step-label">Photo & AI</div>
        </div>
        <div class="wizard-step-item" data-step="2">
          <div class="wizard-step-circle">2</div>
          <div class="wizard-step-label">AI Diagnostic</div>
        </div>
        <div class="wizard-step-item" data-step="3">
          <div class="wizard-step-circle">3</div>
          <div class="wizard-step-label">Issue Details</div>
        </div>
        <div class="wizard-step-item" data-step="4">
          <div class="wizard-step-circle">4</div>
          <div class="wizard-step-label">Location</div>
        </div>
        <div class="wizard-step-item" data-step="5">
          <div class="wizard-step-circle">5</div>
          <div class="wizard-step-label">Review & Submit</div>
        </div>
      </div>

      <!-- WIZARD STEP 1: Image Capture & Upload -->
      <div class="wizard-step-panel" data-step="1">
        <div class="form-card">
          <h2 style="font-size: 1.4rem; margin-bottom: 0.5rem;">Step 1: Capture or Upload Photograph</h2>
          <p style="color: var(--neutral-500); font-size: 0.925rem; margin-bottom: 1.75rem;">
            Upload a clear photo of the civic issue. Our AI will analyze the image to detect the problem and route it properly.
          </p>

          <!-- Drag and Drop Zone -->
          <div id="ai-drop-zone" class="ai-upload-zone">
            <input type="file" id="image-file-input" accept="image/jpeg,image/png,image/webp,image/jpg" style="display: none;" />
            
            <div class="ai-upload-icon-wrapper">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size: 2rem;"></i>
            </div>
            
            <div class="ai-upload-title">Drag and drop your photo here</div>
            <div class="ai-upload-subtitle">Supports JPG, PNG, WEBP up to 15MB. You can also capture directly using your camera.</div>
            
            <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
              <button type="button" id="btn-browse-file" class="btn btn-primary">
                <i class="fa-solid fa-folder-open"></i> Browse Files
              </button>
            </div>
          </div>

          <!-- Quick Test Samples Selector -->
          <div style="margin-top: 1.75rem; padding-top: 1.25rem; border-top: 1px solid var(--neutral-200);">
            <div style="font-size: 0.825rem; font-weight: 700; color: var(--neutral-500); text-transform: uppercase; margin-bottom: 0.75rem;">
              Or Select a Sample Civic Problem for Instant AI Testing:
            </div>
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm sample-img-btn" data-url="https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80" data-label="Road Pothole">
                <i class="fa-solid fa-road"></i> Sample: Road Pothole
              </button>
              <button type="button" class="btn btn-outline btn-sm sample-img-btn" data-url="https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=800&q=80" data-label="Water Leak">
                <i class="fa-solid fa-faucet-drip"></i> Sample: Water Leakage
              </button>
              <button type="button" class="btn btn-outline btn-sm sample-img-btn" data-url="https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?auto=format&fit=crop&w=800&q=80" data-label="Garbage Pile">
                <i class="fa-solid fa-trash-can"></i> Sample: Garbage Pile
              </button>
              <button type="button" class="btn btn-outline btn-sm sample-img-btn" data-url="https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80" data-label="Dark Streetlight">
                <i class="fa-solid fa-bolt"></i> Sample: Dark Streetlight
              </button>
            </div>
          </div>

          <!-- Manual Skip option -->
          <div style="margin-top: 1.5rem; text-align: center;">
            <button type="button" id="btn-skip-to-manual" class="btn btn-outline btn-sm" style="border: none; color: var(--neutral-500);">
              No photo available? Continue with manual reporting &rarr;
            </button>
          </div>
        </div>
      </div>

      <!-- WIZARD STEP 2: AI Scanning & Diagnostics Stage -->
      <div class="wizard-step-panel hidden" data-step="2">
        <div class="form-card">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;">
            <div>
              <h2 style="font-size: 1.4rem; margin-bottom: 0.25rem;">Step 2: AI Vision Understanding</h2>
              <p style="color: var(--neutral-500); font-size: 0.9rem;">
                CivicAI is analyzing the photo for visual patterns, surface fractures, and civic hazards.
              </p>
            </div>
            <button type="button" id="btn-reupload-image" class="btn btn-outline btn-sm">
              <i class="fa-solid fa-arrow-rotate-left"></i> Change Photo
            </button>
          </div>

          <!-- Scanning Stage Container -->
          <div class="ai-preview-stage">
            <img id="ai-scan-preview-img" class="ai-preview-image" src="" alt="Issue Preview" />
            
            <!-- Scanner HUD Overlay -->
            <div id="ai-scanner-overlay" class="ai-scanner-overlay active">
              <div class="ai-laser-line"></div>
              <div class="ai-target-reticle">
                <div class="ai-target-corner corner-tl"></div>
                <div class="ai-target-corner corner-tr"></div>
                <div class="ai-target-corner corner-bl"></div>
                <div class="ai-target-corner corner-br"></div>
              </div>
              <div class="ai-hud-status">
                <span id="ai-hud-message"><i class="fa-solid fa-brain" style="color: #2dd4bf; margin-right: 6px;"></i> Analyzing image contours...</span>
                <div class="ai-hud-spinner"></div>
              </div>
            </div>
          </div>

          <!-- AI Result Output Card (revealed after scan) -->
          <div id="ai-result-card-container" class="hidden">
            <div class="ai-result-card">
              <div class="ai-result-header">
                <div>
                  <span style="font-size: 0.775rem; font-weight: 700; color: var(--primary-700); text-transform: uppercase; letter-spacing: 0.05em;">
                    AI Analysis Complete
                  </span>
                  <h3 id="ai-res-title" style="font-size: 1.35rem; color: var(--neutral-950); margin-top: 0.2rem;">
                    Pothole Detected
                  </h3>
                </div>
                <div class="ai-result-badge-group">
                  <span id="ai-res-confidence-badge" class="badge badge-confidence-high">94.6% High Confidence</span>
                  <span id="ai-res-severity-badge" class="badge badge-severity-high">High Severity</span>
                </div>
              </div>

              <div class="ai-result-grid">
                <div class="ai-metric-item">
                  <div class="ai-metric-label">Recommended Category</div>
                  <div class="ai-metric-value" id="ai-res-category">
                    <i class="fa-solid fa-road" style="color: var(--primary-600);"></i> Roads & Transportation
                  </div>
                </div>

                <div class="ai-metric-item">
                  <div class="ai-metric-label">Confidence Rating</div>
                  <div class="ai-metric-value" id="ai-res-confidence-text">
                    94.6%
                  </div>
                  <div class="confidence-meter">
                    <div id="ai-res-confidence-bar" class="confidence-bar-fill" style="width: 94.6%;"></div>
                  </div>
                </div>
              </div>

              <!-- AI Explanation -->
              <div class="ai-explanation-box">
                <h4><i class="fa-solid fa-robot"></i> AI Visual Explanation</h4>
                <p id="ai-res-explanation">Visual inspection detected asphalt cavities with significant depth.</p>
              </div>

              <!-- Suggested Description -->
              <div class="ai-desc-box">
                <h4>
                  <span><i class="fa-solid fa-wand-magic-sparkles"></i> AI Suggested Description</span>
                  <button type="button" id="btn-use-ai-desc" class="btn btn-outline btn-sm" style="background: white;">
                    <i class="fa-solid fa-check"></i> Use Description
                  </button>
                </h4>
                <div class="ai-desc-text" id="ai-res-desc">
                  "A deep pothole is visible on the road and may create severe difficulty for vehicles."
                </div>
              </div>

              <!-- AI Disclaimer -->
              <div class="ai-disclaimer">
                <i class="fa-solid fa-circle-info" style="margin-top: 2px;"></i>
                <div>
                  CivicAI provides recommendations to make reporting faster. You can review, edit, or manually change the category and details on the next step.
                </div>
              </div>

              <!-- Decision Buttons -->
              <div style="display: flex; gap: 1rem; justify-content: flex-end; flex-wrap: wrap;">
                <button type="button" id="btn-res-analyze-again" class="btn btn-outline">
                  <i class="fa-solid fa-arrows-rotate"></i> Re-Analyze
                </button>
                <button type="button" id="btn-res-use-result" class="btn btn-primary btn-lg">
                  Use This Result &rarr;
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- WIZARD STEP 3: Category, Dynamic Fields & Description -->
      <div class="wizard-step-panel hidden" data-step="3">
        <div class="form-card">
          <h2 style="font-size: 1.4rem; margin-bottom: 0.5rem;">Step 3: Confirm Details & Information</h2>
          <p style="color: var(--neutral-500); font-size: 0.925rem; margin-bottom: 2rem;">
            Verify the category and fill in specific observations to assist the municipal dispatch team.
          </p>

          <!-- Category Selector -->
          <div class="form-group">
            <label class="form-label form-label-required">Civic Issue Category</label>
            <div class="category-selector-grid" id="category-picker-grid">
              ${Object.keys(CIVIC_TAXONOMY).map(catName => `
                <div class="category-radio-card ${reportData.category === catName ? 'selected' : ''}" data-cat="${catName}">
                  <div class="category-icon">
                    <i class="fa-solid ${CIVIC_TAXONOMY[catName].icon}"></i>
                  </div>
                  <div style="font-size: 0.875rem; font-weight: 600;">${catName}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Subcategory Dropdown -->
          <div class="form-group">
            <label class="form-label form-label-required" for="report-subcategory">Specific Problem Type</label>
            <select id="report-subcategory" class="form-control">
            </select>
          </div>

          <!-- Dynamic Category Fields Container -->
          <div id="dynamic-category-fields-container" class="dynamic-fields-card">
          </div>

          <!-- Severity Selector -->
          <div class="form-group" style="margin-top: 1.5rem;">
            <label class="form-label form-label-required">
              <span>Urgency & Severity Level</span>
              <span class="form-hint">AI recommended: <strong id="ai-rec-sev-label">${reportData.severity}</strong></span>
            </label>
            <div class="severity-selector">
              ${SEVERITY_LEVELS.map(sev => `
                <div class="severity-pill-label ${reportData.severity === sev ? 'selected' : ''}" data-severity="${sev}">
                  ${sev} Severity
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Report Title -->
          <div class="form-group">
            <label class="form-label form-label-required" for="report-title">Report Title</label>
            <input type="text" id="report-title" class="form-control" placeholder="e.g. Deep Pothole on Main Road near Metro Station" />
          </div>

          <!-- Description -->
          <div class="form-group">
            <div class="form-label form-label-required">
              <span>Detailed Description</span>
              <button type="button" id="btn-fill-ai-desc" class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 2px 8px;">
                <i class="fa-solid fa-wand-magic-sparkles"></i> Auto-fill with AI
              </button>
            </div>
            <textarea id="report-description" class="form-control" placeholder="Provide helpful context, hazards, or frequency of the issue..."></textarea>
          </div>

          <!-- Navigation -->
          <div style="display: flex; justify-content: space-between; margin-top: 2.5rem;">
            <button type="button" class="btn btn-outline btn-prev-step" data-target="2">
              &larr; Back
            </button>
            <button type="button" id="btn-step3-next" class="btn btn-primary btn-lg">
              Next: Location &rarr;
            </button>
          </div>

        </div>
      </div>

      <!-- WIZARD STEP 4: Location & Interactive Map -->
      <div class="wizard-step-panel hidden" data-step="4">
        <div class="form-card">
          <h2 style="font-size: 1.4rem; margin-bottom: 0.5rem;">Step 4: Pin the Exact Location</h2>
          <p style="color: var(--neutral-500); font-size: 0.925rem; margin-bottom: 1.75rem;">
            Accurate location enables municipal field workers to reach and resolve the issue quickly.
          </p>

          <div class="location-picker-box">
            <div class="location-toolbar">
              <button type="button" id="btn-detect-gps" class="btn btn-secondary btn-sm">
                <i class="fa-solid fa-location-crosshairs"></i> Use My Current GPS Location
              </button>
              <div class="location-coord-badge" id="map-coord-display">
                Lat: ${reportData.latitude.toFixed(4)}, Lng: ${reportData.longitude.toFixed(4)}
              </div>
            </div>

            <div id="report-map" class="location-map-container"></div>
          </div>

          <div class="form-group" style="margin-top: 1.5rem;">
            <label class="form-label form-label-required" for="report-location">Street Address / Area</label>
            <input type="text" id="report-location" class="form-control" placeholder="e.g. 12th Main Road, Indiranagar, Bengaluru" />
          </div>

          <div class="form-group">
            <label class="form-label" for="report-landmark">
              <span>Landmark / Nearby Reference</span>
              <span class="form-hint">Optional</span>
            </label>
            <input type="text" id="report-landmark" class="form-control" placeholder="e.g. Opposite State Bank, Near Electric Pole #4" />
          </div>

          <!-- Navigation -->
          <div style="display: flex; justify-content: space-between; margin-top: 2.5rem;">
            <button type="button" class="btn btn-outline btn-prev-step" data-target="3">
              &larr; Back
            </button>
            <button type="button" id="btn-step4-next" class="btn btn-primary btn-lg">
              Review Report &rarr;
            </button>
          </div>

        </div>
      </div>

      <!-- WIZARD STEP 5: Final Review & Submission -->
      <div class="wizard-step-panel hidden" data-step="5">
        <div class="form-card" id="report-review-container">
        </div>
      </div>

      <!-- WIZARD STEP 6: Success Confirmation -->
      <div class="wizard-step-panel hidden" data-step="6">
        <div class="form-card" style="text-align: center; padding: 3.5rem 2rem;">
          <div style="width: 72px; height: 72px; border-radius: 50%; background: #ecfdf5; color: #059669; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin: 0 auto 1.5rem auto;">
            <i class="fa-solid fa-circle-check"></i>
          </div>

          <h2 style="font-size: 1.75rem; color: var(--neutral-900); margin-bottom: 0.5rem;">
            Your Civic Issue Has Been Reported Successfully!
          </h2>
          <p style="color: var(--neutral-500); max-width: 520px; margin: 0 auto 2rem auto;">
            The report has been registered in the municipal database with AI diagnostics and assigned to the municipal dispatch unit.
          </p>

          <div style="background: var(--neutral-50); border: 1px solid var(--neutral-200); border-radius: var(--radius-lg); padding: 1.5rem; max-width: 480px; margin: 0 auto 2.5rem auto; text-align: left;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--neutral-200); padding-bottom: 0.75rem;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--neutral-500); text-transform: uppercase;">Public Report ID</span>
              <span class="mono" id="success-report-id" style="font-size: 1.15rem; font-weight: 800; color: var(--primary-800);">CIV-2026-XXXXX</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.85rem;">
              <div>
                <span style="color: var(--neutral-500); display: block;">Category</span>
                <strong id="success-category" style="color: var(--neutral-900);">Roads</strong>
              </div>
              <div>
                <span style="color: var(--neutral-500); display: block;">Status</span>
                <span class="badge badge-status-submitted">Submitted</span>
              </div>
              <div>
                <span style="color: var(--neutral-500); display: block;">Assigned Department</span>
                <strong id="success-dept" style="color: var(--neutral-800);">Public Works</strong>
              </div>
              <div>
                <span style="color: var(--neutral-500); display: block;">Severity</span>
                <span id="success-severity-badge" class="badge badge-severity-high">High</span>
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
            <button type="button" id="btn-success-track" class="btn btn-primary btn-lg">
              <i class="fa-solid fa-route"></i> Track This Report
            </button>
            <button type="button" id="btn-success-dashboard" class="btn btn-outline btn-lg">
              <i class="fa-solid fa-chart-line"></i> Go to My Reports
            </button>
          </div>
        </div>
      </div>

    </div>
  `;

  // --- Dynamic Category Fields update ---
  function updateCategoryFields(catName) {
    reportData.category = catName;
    const catData = CIVIC_TAXONOMY[catName] || CIVIC_TAXONOMY['Roads & Transportation'];

    const subcatSelect = document.getElementById('report-subcategory');
    if (subcatSelect) {
      subcatSelect.innerHTML = catData.subcategories.map(sub => `
        <option value="${sub}" ${reportData.subcategory === sub ? 'selected' : ''}>${sub}</option>
      `).join('');
      reportData.subcategory = subcatSelect.value;
    }

    const dynamicContainer = document.getElementById('dynamic-category-fields-container');
    if (dynamicContainer && catData.dynamicFields) {
      dynamicContainer.innerHTML = `
        <div style="font-size: 0.825rem; font-weight: 700; color: var(--primary-800); text-transform: uppercase; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-sliders"></i> ${catName} Specific Attributes
        </div>
        <div class="form-row">
          ${catData.dynamicFields.map(field => `
            <div class="form-group">
              <label class="form-label ${field.required ? 'form-label-required' : ''}">${field.label}</label>
              ${field.type === 'select' ? `
                <select class="form-control dynamic-meta-input" data-field-id="${field.id}">
                  ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                </select>
              ` : `
                <input type="text" class="form-control dynamic-meta-input" data-field-id="${field.id}" placeholder="${field.placeholder || ''}" />
              `}
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  // --- Step 1 Handlers ---
  const dropZone = document.getElementById('ai-drop-zone');
  const fileInput = document.getElementById('image-file-input');

  document.getElementById('btn-browse-file')?.addEventListener('click', () => fileInput.click());

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleImageSelected(e.target.files[0]);
    }
  });

  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));

  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageSelected(e.dataTransfer.files[0]);
    }
  });

  container.querySelectorAll('.sample-img-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.url;
      reportData.imageFile = null;
      reportData.imageDataUrl = url;
      currentStep = 2;
      updateWizardUI();
      runAIAnalysis(url);
    });
  });

  document.getElementById('btn-skip-to-manual')?.addEventListener('click', () => {
    reportData.imageDataUrl = 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80';
    currentStep = 3;
    updateCategoryFields(reportData.category);
    updateWizardUI();
  });

  async function handleImageSelected(file) {
    if (!file.type.startsWith('image/')) {
      notificationService.showToast('Invalid File', 'Please upload a valid JPEG, PNG, or WEBP image.', 'error');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      notificationService.showToast('File Too Large', 'Please upload an image smaller than 15MB.', 'error');
      return;
    }

    reportData.imageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      reportData.imageDataUrl = e.target.result;
      currentStep = 2;
      updateWizardUI();
      runAIAnalysis(reportData.imageDataUrl);
    };
    reader.readAsDataURL(file);
  }

  // --- Step 2 AI Scan Handlers ---
  async function runAIAnalysis(imageSource) {
    const previewImg = document.getElementById('ai-scan-preview-img');
    const overlay = document.getElementById('ai-scanner-overlay');
    const hudMsg = document.getElementById('ai-hud-message');
    const resultCard = document.getElementById('ai-result-card-container');

    if (previewImg) previewImg.src = imageSource;
    if (overlay) overlay.classList.add('active');
    if (resultCard) resultCard.classList.add('hidden');

    try {
      const result = await AIVisionService.analyzeImage(imageSource, (msg, pct) => {
        if (hudMsg) hudMsg.innerHTML = `<i class="fa-solid fa-brain" style="color: #2dd4bf; margin-right: 6px;"></i> ${msg} (${pct}%)`;
      });

      reportData.aiResult = result;
      reportData.category = result.category;
      reportData.subcategory = result.subcategory;
      reportData.severity = result.severity;
      reportData.title = result.detected_issue;
      reportData.description = result.ai_generated_description;

      document.getElementById('ai-res-title').textContent = result.detected_issue;
      document.getElementById('ai-res-category').innerHTML = `<i class="fa-solid ${CIVIC_TAXONOMY[result.category]?.icon || 'fa-triangle-exclamation'}"></i> ${result.category}`;
      document.getElementById('ai-res-confidence-text').textContent = `${result.confidence}% (${result.confidenceTier})`;
      document.getElementById('ai-res-confidence-bar').style.width = `${result.confidence}%`;
      document.getElementById('ai-res-explanation').textContent = result.ai_explanation;
      document.getElementById('ai-res-desc').textContent = `"${result.ai_generated_description}"`;

      const sevBadge = document.getElementById('ai-res-severity-badge');
      sevBadge.textContent = `${result.severity} Severity`;
      sevBadge.className = `badge badge-severity-${result.severity.toLowerCase()}`;

      const confBadge = document.getElementById('ai-res-confidence-badge');
      confBadge.textContent = result.confidenceTier;
      confBadge.className = `badge badge-confidence-${result.confidenceClass}`;

      if (overlay) overlay.classList.remove('active');
      if (resultCard) resultCard.classList.remove('hidden');

      notificationService.showToast('AI Scan Complete', `Detected ${result.detected_issue} with ${result.confidence}% confidence.`, 'success');
    } catch (err) {
      console.error('AI Scan Error:', err);
      if (overlay) overlay.classList.remove('active');
      notificationService.showToast('AI Notice', 'AI diagnosis is running in fallback mode.', 'warning');
      if (resultCard) resultCard.classList.remove('hidden');
    }
  }

  document.getElementById('btn-reupload-image')?.addEventListener('click', () => {
    currentStep = 1;
    updateWizardUI();
  });

  document.getElementById('btn-res-analyze-again')?.addEventListener('click', () => {
    if (reportData.imageDataUrl) runAIAnalysis(reportData.imageDataUrl);
  });

  document.getElementById('btn-use-ai-desc')?.addEventListener('click', () => {
    if (reportData.aiResult) {
      reportData.description = reportData.aiResult.ai_generated_description;
      notificationService.showToast('Description Copied', 'AI description will be pre-filled in your report.', 'info');
    }
  });

  document.getElementById('btn-res-use-result')?.addEventListener('click', () => {
    currentStep = 3;
    updateCategoryFields(reportData.category);
    
    const titleEl = document.getElementById('report-title');
    const descEl = document.getElementById('report-description');
    if (titleEl) titleEl.value = reportData.title;
    if (descEl) descEl.value = reportData.description;

    updateWizardUI();
  });

  // --- Step 3 Category & Details Handlers ---
  container.querySelectorAll('.category-radio-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.category-radio-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      const cat = card.dataset.cat;
      updateCategoryFields(cat);
    });
  });

  container.querySelectorAll('.severity-pill-label').forEach(pill => {
    pill.addEventListener('click', () => {
      container.querySelectorAll('.severity-pill-label').forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
      reportData.severity = pill.dataset.severity;
    });
  });

  document.getElementById('btn-fill-ai-desc')?.addEventListener('click', () => {
    const descEl = document.getElementById('report-description');
    if (reportData.aiResult && descEl) {
      descEl.value = reportData.aiResult.ai_generated_description;
    }
  });

  document.getElementById('btn-step3-next')?.addEventListener('click', () => {
    const titleVal = document.getElementById('report-title')?.value.trim();
    const descVal = document.getElementById('report-description')?.value.trim();
    const subcatVal = document.getElementById('report-subcategory')?.value;

    if (!titleVal) {
      notificationService.showToast('Title Required', 'Please enter a clear title for the report.', 'error');
      document.getElementById('report-title')?.focus();
      return;
    }
    if (!descVal) {
      notificationService.showToast('Description Required', 'Please provide a short description of the issue.', 'error');
      document.getElementById('report-description')?.focus();
      return;
    }

    reportData.title = titleVal;
    reportData.description = descVal;
    reportData.subcategory = subcatVal;

    const meta = {};
    container.querySelectorAll('.dynamic-meta-input').forEach(inp => {
      meta[inp.dataset.fieldId] = inp.value;
    });
    reportData.category_metadata = meta;

    currentStep = 4;
    updateWizardUI();
  });

  // --- Step 4 Location Handlers ---
  function initLocationMap() {
    mapInstance = LocationService.initMap('report-map', reportData.latitude, reportData.longitude, (lat, lng, address) => {
      reportData.latitude = lat;
      reportData.longitude = lng;
      reportData.location = address;

      const locInput = document.getElementById('report-location');
      const coordBadge = document.getElementById('map-coord-display');
      if (locInput && address !== 'Locating address...') locInput.value = address;
      if (coordBadge) coordBadge.textContent = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
    });

    if (!reportData.location) {
      LocationService.reverseGeocode(reportData.latitude, reportData.longitude).then(res => {
        reportData.location = res.formattedAddress;
        const locInput = document.getElementById('report-location');
        if (locInput) locInput.value = res.formattedAddress;
      });
    }
  }

  document.getElementById('btn-detect-gps')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-detect-gps');
    btn.classList.add('loading');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Detecting GPS...`;

    try {
      const pos = await LocationService.getCurrentPosition();
      reportData.latitude = pos.latitude;
      reportData.longitude = pos.longitude;
      if (mapInstance) {
        mapInstance.setView(pos.latitude, pos.longitude, 16);
      }
      notificationService.showToast('GPS Detected', 'Location updated to your current position.', 'success');
    } catch (e) {
      notificationService.showToast('Location Permission', 'Could not access GPS. You can enter the street address manually.', 'warning');
    } finally {
      btn.classList.remove('loading');
      btn.innerHTML = `<i class="fa-solid fa-location-crosshairs"></i> Use My Current GPS Location`;
    }
  });

  document.getElementById('btn-step4-next')?.addEventListener('click', () => {
    const locVal = document.getElementById('report-location')?.value.trim();
    const landmarkVal = document.getElementById('report-landmark')?.value.trim();

    if (!locVal) {
      notificationService.showToast('Location Required', 'Please provide the street address or location of the issue.', 'error');
      document.getElementById('report-location')?.focus();
      return;
    }

    reportData.location = locVal;
    reportData.landmark = landmarkVal;

    currentStep = 5;
    updateWizardUI();
  });

  container.querySelectorAll('.btn-prev-step').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStep = parseInt(btn.dataset.target, 10);
      updateWizardUI();
    });
  });

  // --- Step 5 Review & Submission ---
  function renderReviewStep() {
    const reviewCard = document.getElementById('report-review-container');
    if (!reviewCard) return;

    reviewCard.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
        <div>
          <h2 style="font-size: 1.4rem; margin-bottom: 0.25rem;">Step 5: Review Your Civic Report</h2>
          <p style="color: var(--neutral-500); font-size: 0.9rem;">
            Please verify all information before submitting to municipal authorities.
          </p>
        </div>
        <span class="badge badge-status-submitted">Ready for Dispatch</span>
      </div>

      <div style="display: grid; grid-template-columns: 240px 1fr; gap: 1.5rem; margin-bottom: 2rem; background: var(--neutral-50); border: 1px solid var(--neutral-200); border-radius: var(--radius-lg); padding: 1.25rem;">
        <div style="border-radius: var(--radius-md); overflow: hidden; height: 160px; background: var(--neutral-900);">
          <img src="${reportData.imageDataUrl}" alt="Issue Photo" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>

        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span class="badge badge-severity-${reportData.severity.toLowerCase()}">${reportData.severity} Severity</span>
            <span class="badge" style="background: white; border: 1px solid var(--neutral-300);">${reportData.category}</span>
          </div>

          <h3 style="font-size: 1.2rem; color: var(--neutral-900); margin-bottom: 0.5rem;">${reportData.title}</h3>
          <p style="font-size: 0.875rem; color: var(--neutral-600); line-height: 1.5; margin-bottom: 0.75rem;">
            ${reportData.description}
          </p>

          <div style="font-size: 0.825rem; color: var(--neutral-500); display: flex; align-items: center; gap: 0.4rem;">
            <i class="fa-solid fa-location-dot" style="color: var(--color-critical);"></i>
            <strong>${reportData.location}</strong> ${reportData.landmark ? `(Near: ${reportData.landmark})` : ''}
          </div>
        </div>
      </div>

      <!-- AI Diagnostics Summary -->
      ${reportData.aiResult ? `
        <div style="background: var(--primary-50); border: 1px solid var(--primary-200); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 2rem; font-size: 0.85rem;">
          <div style="font-weight: 700; color: var(--primary-900); margin-bottom: 0.25rem;">
            <i class="fa-solid fa-microchip"></i> Attached AI Diagnostic Evidence
          </div>
          <div style="color: var(--primary-800);">
            Model: <strong>${reportData.aiResult.detected_issue}</strong> &bull; Confidence: <strong>${reportData.aiResult.confidence}%</strong> &bull; Department: <strong>${CIVIC_TAXONOMY[reportData.category]?.department || 'Municipal Cell'}</strong>
          </div>
        </div>
      ` : ''}

      <!-- Actions -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <button type="button" class="btn btn-outline btn-prev-step" data-target="4">
          &larr; Edit Details
        </button>
        <button type="button" id="btn-final-submit-report" class="btn btn-ai btn-lg">
          <i class="fa-solid fa-paper-plane"></i> Submit Report to Authority
        </button>
      </div>
    `;

    document.getElementById('btn-final-submit-report')?.addEventListener('click', handleFinalSubmit);
  }

  async function handleFinalSubmit() {
    const btn = document.getElementById('btn-final-submit-report');
    btn.classList.add('loading');
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Submitting to Supabase...`;

    try {
      let uploadedUrl = reportData.imageDataUrl;
      if (reportData.imageFile) {
        uploadedUrl = await uploadImageToSupabase(reportData.imageFile);
      }

      const user = auth.getUser();
      const payload = {
        user_id: user ? (user.id || user.user_id) : 'user-citizen-1',
        category: reportData.category,
        subcategory: reportData.subcategory,
        title: reportData.title,
        description: reportData.description,
        location: reportData.location,
        landmark: reportData.landmark,
        latitude: reportData.latitude,
        longitude: reportData.longitude,
        severity: reportData.severity,
        image_url: uploadedUrl,
        ai_detected_issue: reportData.aiResult?.detected_issue || reportData.title,
        ai_category: reportData.aiResult?.category || reportData.category,
        ai_confidence: parseFloat(reportData.aiResult?.confidence || 92.0),
        ai_severity: reportData.aiResult?.severity || reportData.severity,
        ai_explanation: reportData.aiResult?.ai_explanation || '',
        ai_generated_description: reportData.aiResult?.ai_generated_description || '',
        assigned_authority: CIVIC_TAXONOMY[reportData.category]?.department || 'Municipal Grievance Cell',
        category_metadata: reportData.category_metadata
      };

      const created = await db.createReport(payload);
      reportData.submittedReport = created;

      document.getElementById('success-report-id').textContent = created.report_id;
      document.getElementById('success-category').textContent = created.category;
      document.getElementById('success-dept').textContent = created.assigned_authority;
      const sevEl = document.getElementById('success-severity-badge');
      sevEl.textContent = `${created.severity} Severity`;
      sevEl.className = `badge badge-severity-${created.severity.toLowerCase()}`;

      currentStep = 6;
      updateWizardUI();

      document.getElementById('btn-success-track')?.addEventListener('click', () => {
        navigateTo('track', { reportId: created.report_id });
      });
      document.getElementById('btn-success-dashboard')?.addEventListener('click', () => {
        navigateTo('citizen-dash');
      });

    } catch (error) {
      console.error('Submission failed:', error);
      notificationService.showToast('Submission Error', 'Could not submit report. Please try again.', 'error');
      btn.classList.remove('loading');
      btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Submit Report to Authority`;
    }
  }

  updateCategoryFields(reportData.category);
  updateWizardUI();
}

/**
 * Authentication Barrier Prompt: Renders when unauthenticated citizen tries to report
 */
function renderAuthRequiredPrompt(container, navigateTo, params) {
  container.innerHTML = `
    <div class="container section-sm" style="max-width: 600px;">
      <div class="card" style="text-align: center; padding: 3.5rem 2rem; border-color: var(--primary-200); box-shadow: var(--shadow-xl);">
        
        <div style="width: 72px; height: 72px; border-radius: 50%; background: var(--primary-50); color: var(--primary-700); display: flex; align-items: center; justify-content: center; font-size: 2rem; margin: 0 auto 1.5rem auto; border: 2px dashed var(--primary-300);">
          <i class="fa-solid fa-user-lock"></i>
        </div>

        <div class="section-tag" style="margin-bottom: 0.75rem;">
          <i class="fa-solid fa-shield-halved"></i> Verified Citizen Reporting
        </div>

        <h2 style="font-size: 1.75rem; color: var(--neutral-900); margin-bottom: 0.75rem;">
          Sign In or Sign Up to Report an Issue
        </h2>

        <p style="color: var(--neutral-600); font-size: 0.95rem; line-height: 1.6; max-width: 480px; margin: 0 auto 2rem auto;">
          To ensure genuine civic reports, prevent spam, and allow you to track real-time resolution updates, you must be signed in with your email account.
        </p>

        <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem;">
          <button type="button" id="btn-prompt-signin" class="btn btn-primary btn-lg">
            <i class="fa-solid fa-right-to-bracket"></i> Sign In to Account
          </button>
          <button type="button" id="btn-prompt-signup" class="btn btn-outline btn-lg">
            <i class="fa-solid fa-user-plus"></i> Create Free Account
          </button>
        </div>

        <div style="background: var(--neutral-50); border: 1px solid var(--neutral-200); border-radius: var(--radius-md); padding: 1rem; text-align: left; font-size: 0.825rem; color: var(--neutral-600);">
          <div style="font-weight: 700; color: var(--neutral-800); margin-bottom: 0.25rem;">
            <i class="fa-solid fa-lock" style="color: var(--primary-600);"></i> Why is login required?
          </div>
          <div>
            1. Municipal field officers can contact you if landmark clarification is needed.<br/>
            2. You receive automated SMS/Email notifications when work begins and completes.<br/>
            3. Keeps city data spam-free and high-integrity for rapid civic dispatch.
          </div>
        </div>

      </div>
    </div>
  `;

  document.getElementById('btn-prompt-signin')?.addEventListener('click', () => {
    window.CivicAI?.openAuthModal('signin');
  });

  document.getElementById('btn-prompt-signup')?.addEventListener('click', () => {
    window.CivicAI?.openAuthModal('signup');
  });
}
