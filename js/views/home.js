/**
 * CIVICAI: Home View
 * Hero, AI Visualizer, 9 Civic Categories, How It Works & Impact Metrics
 */

import { CIVIC_TAXONOMY } from '../config.js';
import { db } from '../storage-db.js';
import { auth } from '../auth-service.js';

export async function renderHome(container, navigateTo) {
  const stats = await db.getDashboardStats('citizen');

  container.innerHTML = `
    <!-- Hero Section -->
    <section class="section hero-section" style="background: linear-gradient(180deg, #f0fdfa 0%, #ffffff 100%); padding-top: 4.5rem; padding-bottom: 5rem; border-bottom: 1px solid var(--neutral-200);">
      <div class="container">
        <div style="display: grid; grid-template-columns: 1.15fr 0.85fr; gap: 3.5rem; align-items: center;">
          
          <!-- Hero Left Content -->
          <div>
            <div class="section-tag" style="background: white; box-shadow: var(--shadow-xs);">
              <i class="fa-solid fa-shield-halved" style="color: var(--primary-600);"></i>
              Smart City Civic Intelligence Platform
            </div>
            
            <h1 style="margin-bottom: 1.25rem; color: var(--neutral-950); line-height: 1.15;">
              Report. Resolve. <br/>
              <span style="color: var(--primary-700);">Improve Your City.</span>
            </h1>
            
            <p style="font-size: 1.15rem; color: var(--neutral-600); margin-bottom: 2rem; line-height: 1.6; max-width: 540px;">
              Report roads, water, electricity, sanitation, infrastructure, and other civic problems from one unified platform. CivicAI uses multimodal AI to identify issues instantly, route to municipal authorities, and track resolution.
            </p>

            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2.5rem;">
              <button id="hero-btn-report" class="btn btn-primary btn-lg">
                <i class="fa-solid fa-camera"></i>
                Report an Issue
              </button>
              <button id="hero-btn-track" class="btn btn-outline btn-lg">
                <i class="fa-solid fa-magnifying-glass-location"></i>
                Track My Report
              </button>
            </div>

            <!-- Smart City Metric Badges -->
            <div style="display: flex; align-items: center; gap: 2rem; border-top: 1px solid var(--neutral-200); padding-top: 1.5rem; flex-wrap: wrap;">
              <div>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary-800);">${stats.total + 1240}+</div>
                <div style="font-size: 0.8rem; color: var(--neutral-500); font-weight: 600;">Reports Resolved</div>
              </div>
              <div style="width: 1px; height: 32px; background: var(--neutral-300);"></div>
              <div>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--secondary-700);">94.8%</div>
                <div style="font-size: 0.8rem; color: var(--neutral-500); font-weight: 600;">AI Vision Accuracy</div>
              </div>
              <div style="width: 1px; height: 32px; background: var(--neutral-300);"></div>
              <div>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--neutral-800);">9 Categories</div>
                <div style="font-size: 0.8rem; color: var(--neutral-500); font-weight: 600;">Unified Coverage</div>
              </div>
            </div>
          </div>

          <!-- Hero Right: Interactive AI Diagnostic Visualizer Simulation -->
          <div style="position: relative;">
            <div style="
              background: white; 
              border: 1px solid var(--neutral-200); 
              border-radius: var(--radius-xl); 
              padding: 1.5rem; 
              box-shadow: var(--shadow-xl);
              position: relative;
            ">
              <!-- Live City Scanner Header -->
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--neutral-100);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981; display: inline-block; animation: pulseDot 2s infinite;"></span>
                  <span style="font-size: 0.85rem; font-weight: 700; color: var(--neutral-800);">CivicAI Vision Diagnostics</span>
                </div>
                <span class="badge badge-status-under-review">Live Scanning</span>
              </div>

              <!-- Simulated Photo Preview with Scan Overlay -->
              <div style="position: relative; border-radius: var(--radius-lg); overflow: hidden; height: 240px; background: var(--neutral-900);">
                <img 
                  src="https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80" 
                  alt="AI Civic Scan Preview" 
                  style="width: 100%; height: 100%; object-fit: cover; opacity: 0.9;"
                />
                <div style="
                  position: absolute; 
                  top: 0; left: 0; right: 0; height: 3px; 
                  background: linear-gradient(90deg, transparent, #2dd4bf, transparent);
                  box-shadow: 0 0 15px #14b8a6;
                  animation: laserSweep 2s ease-in-out infinite alternate;
                "></div>
                <div style="
                  position: absolute; 
                  top: 25%; left: 30%; width: 140px; height: 100px;
                  border: 2px dashed #2dd4bf;
                  border-radius: var(--radius-sm);
                  box-shadow: inset 0 0 15px rgba(20, 184, 166, 0.3);
                ">
                  <span style="position: absolute; top: -20px; left: 0; background: #0f766e; color: white; font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px;">
                    POTHOLE 94.6%
                  </span>
                </div>
              </div>

              <!-- AI Output Card Preview -->
              <div style="margin-top: 1rem; background: var(--neutral-50); border: 1px solid var(--neutral-200); border-radius: var(--radius-md); padding: 1rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                  <span style="font-size: 0.8rem; font-weight: 700; color: var(--neutral-500); text-transform: uppercase;">Detected Issue</span>
                  <span class="badge badge-confidence-high">94.6% High Confidence</span>
                </div>
                <div style="font-size: 1.05rem; font-weight: 800; color: var(--neutral-900); margin-bottom: 0.25rem;">
                  Road Pothole Cluster & Asphalt Fracture
                </div>
                <div style="font-size: 0.825rem; color: var(--neutral-600); display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fa-solid fa-road" style="color: var(--primary-600);"></i>
                  Roads & Transportation &bull; <strong style="color: #ea580c;">High Severity</strong>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>

    <!-- 9 Civic Issue Categories Grid -->
    <section class="section" id="categories-section" style="background: white;">
      <div class="container">
        <div class="section-header">
          <div class="section-tag">
            <i class="fa-solid fa-layer-group"></i> Unified Municipal Coverage
          </div>
          <h2 class="section-title">What Can You Report?</h2>
          <p class="section-desc">
            CivicAI is not just for waste management. Report any visible public infrastructure or civic concern across all 9 municipal domains.
          </p>
        </div>

        <div class="grid grid-cols-3">
          ${Object.entries(CIVIC_TAXONOMY).map(([categoryName, data]) => `
            <div class="card card-interactive category-card" data-category="${categoryName}" style="display: flex; flex-direction: column; height: 100%;">
              <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <div class="category-icon" style="background: ${data.color}15; color: ${data.color}; width: 48px; height: 48px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center; font-size: 1.25rem;">
                  <i class="fa-solid ${data.icon}"></i>
                </div>
                <div>
                  <h3 style="font-size: 1.15rem; margin-bottom: 0.15rem;">${categoryName}</h3>
                  <span style="font-size: 0.775rem; color: var(--neutral-400); font-weight: 600;">${data.subcategories.length} Common Types</span>
                </div>
              </div>
              
              <p style="font-size: 0.9rem; color: var(--neutral-600); margin-bottom: 1.25rem; flex: 1; line-height: 1.5;">
                ${data.description}
              </p>

              <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid var(--neutral-100); padding-top: 0.85rem;">
                <span style="font-size: 0.8rem; font-weight: 600; color: var(--primary-700);">Report This Issue</span>
                <i class="fa-solid fa-arrow-right" style="color: var(--primary-600); font-size: 0.85rem;"></i>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- How CivicAI Works (Connected Timeline) -->
    <section class="section" style="background: var(--neutral-50); border-top: 1px solid var(--neutral-200); border-bottom: 1px solid var(--neutral-200);">
      <div class="container">
        <div class="section-header">
          <div class="section-tag">
            <i class="fa-solid fa-route"></i> Streamlined Citizen Journey
          </div>
          <h2 class="section-title">How CivicAI Works</h2>
          <p class="section-desc">
            From the moment you spot a problem on the street to verified municipal resolution in 5 simple steps.
          </p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; position: relative;">
          
          <div class="card" style="text-align: center; padding: 2rem 1.5rem;">
            <div style="width: 52px; height: 52px; border-radius: var(--radius-full); background: var(--primary-100); color: var(--primary-800); font-weight: 800; font-size: 1.15rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto;">
              01
            </div>
            <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">SPOT</h3>
            <p style="font-size: 0.875rem; color: var(--neutral-600);">Notice a pothole, leak, dark streetlight, or civic issue in your neighborhood.</p>
          </div>

          <div class="card" style="text-align: center; padding: 2rem 1.5rem;">
            <div style="width: 52px; height: 52px; border-radius: var(--radius-full); background: var(--secondary-100); color: var(--secondary-800); font-weight: 800; font-size: 1.15rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto;">
              02
            </div>
            <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">CAPTURE</h3>
            <p style="font-size: 0.875rem; color: var(--neutral-600);">Take a photo with your mobile or upload an existing image directly.</p>
          </div>

          <div class="card" style="text-align: center; padding: 2rem 1.5rem; border-color: var(--primary-300); background: var(--primary-50);">
            <div style="width: 52px; height: 52px; border-radius: var(--radius-full); background: var(--primary-700); color: white; font-weight: 800; font-size: 1.15rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto;">
              03
            </div>
            <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem; color: var(--primary-900);">AI DETECTS</h3>
            <p style="font-size: 0.875rem; color: var(--primary-800);">Multimodal vision auto-identifies issue, category, severity, and drafts description.</p>
          </div>

          <div class="card" style="text-align: center; padding: 2rem 1.5rem;">
            <div style="width: 52px; height: 52px; border-radius: var(--radius-full); background: #fef3c7; color: #b45309; font-weight: 800; font-size: 1.15rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto;">
              04
            </div>
            <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">REPORT</h3>
            <p style="font-size: 0.875rem; color: var(--neutral-600);">Review AI suggestion, confirm location on GPS map, and submit instantly.</p>
          </div>

          <div class="card" style="text-align: center; padding: 2rem 1.5rem;">
            <div style="width: 52px; height: 52px; border-radius: var(--radius-full); background: #ecfdf5; color: #047857; font-weight: 800; font-size: 1.15rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem auto;">
              05
            </div>
            <h3 style="font-size: 1.1rem; margin-bottom: 0.5rem;">TRACK</h3>
            <p style="font-size: 0.875rem; color: var(--neutral-600);">Follow live status updates from municipal dispatch until the issue is resolved.</p>
          </div>

        </div>
      </div>
    </section>
  `;

  // Attach Event Listeners
  document.getElementById('hero-btn-report')?.addEventListener('click', () => {
    navigateTo('report');
  });

  document.getElementById('hero-btn-track')?.addEventListener('click', () => {
    navigateTo('track');
  });

  container.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.dataset.category;
      navigateTo('report', { preselectedCategory: cat });
    });
  });
}
