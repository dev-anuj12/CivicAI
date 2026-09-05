/**
 * CIVICAI: About Platform, Architecture & Responsible AI Manifesto
 */

import { CIVIC_TAXONOMY } from '../config.js';

export async function renderAbout(container, navigateTo) {
  container.innerHTML = `
    <div class="container section-sm" style="max-width: 880px;">
      
      <!-- Hero -->
      <div style="text-align: center; margin-bottom: 3.5rem;">
        <div class="section-tag">
          <i class="fa-solid fa-earth-asia"></i> Smart City Civic Infrastructure
        </div>
        <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">About CivicAI</h1>
        <p style="font-size: 1.15rem; color: var(--neutral-600); max-width: 640px; margin: 0 auto; line-height: 1.6;">
          A unified, AI-powered citizen civic grievance reporting and municipal resolution management platform designed for modern smart governance.
        </p>
      </div>

      <!-- Core Purpose -->
      <div class="card" style="margin-bottom: 2.5rem; padding: 2.5rem;">
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem; color: var(--primary-900);">
          One Platform. Every Civic Issue.
        </h2>
        <p style="color: var(--neutral-700); line-height: 1.7; margin-bottom: 1.25rem;">
          Traditional municipal grievance portals force citizens into complex bureaucratic silos—forcing individuals to guess whether a flooded road belongs to the Public Works Department, Drainage Board, or National Highway Authority.
        </p>
        <p style="color: var(--neutral-700); line-height: 1.7;">
          <strong>CivicAI solves this through multimodal artificial intelligence.</strong> Citizens simply capture a photograph of any public problem. CivicAI analyzes the image, identifies the issue type, measures severity, extracts the GPS coordinates, and automatically routes the grievance to the verified municipal authority with full tracking transparency.
        </p>
      </div>

      <!-- 9 Categories Overview -->
      <div class="card" style="margin-bottom: 2.5rem; padding: 2.5rem;">
        <h3 style="font-size: 1.35rem; margin-bottom: 1.25rem;">Complete Municipal Domain Coverage</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
          ${Object.keys(CIVIC_TAXONOMY).map(c => `
            <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: var(--neutral-50); border-radius: var(--radius-md); border: 1px solid var(--neutral-200);">
              <i class="fa-solid ${CIVIC_TAXONOMY[c].icon}" style="color: ${CIVIC_TAXONOMY[c].color}; font-size: 1.1rem;"></i>
              <span style="font-size: 0.875rem; font-weight: 600; color: var(--neutral-800);">${c}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Responsible AI Manifesto -->
      <div style="
        background: linear-gradient(135deg, var(--neutral-900) 0%, var(--primary-950) 100%);
        color: white;
        border-radius: var(--radius-xl);
        padding: 3rem;
        margin-bottom: 2.5rem;
      ">
        <div class="section-tag" style="background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: var(--primary-300); margin-bottom: 1rem;">
          <i class="fa-solid fa-scale-balanced"></i> Transparency & Ethics
        </div>
        <h2 style="color: white; margin-bottom: 1rem; font-size: 1.75rem;">AI That Assists, Not Replaces You</h2>
        <p style="color: var(--neutral-300); line-height: 1.7; font-size: 1rem; margin-bottom: 1.5rem;">
          CivicAI is built on responsible AI principles. We explicitly state:
        </p>
        
        <ul style="list-style: none; display: flex; flex-direction: column; gap: 1rem; padding: 0; color: var(--neutral-200);">
          <li style="display: flex; gap: 0.75rem; align-items: flex-start;">
            <i class="fa-solid fa-circle-check" style="color: var(--primary-400); margin-top: 4px;"></i>
            <div><strong>Recommendations, Not Infallible Claims:</strong> AI vision provides high-confidence diagnostic recommendations, never presenting computer vision as absolute certainty.</div>
          </li>
          <li style="display: flex; gap: 0.75rem; align-items: flex-start;">
            <i class="fa-solid fa-circle-check" style="color: var(--primary-400); margin-top: 4px;"></i>
            <div><strong>Citizen Sovereignty:</strong> Citizens can always override, re-classify, or customize any AI-generated category, description, or severity level.</div>
          </li>
          <li style="display: flex; gap: 0.75rem; align-items: flex-start;">
            <i class="fa-solid fa-circle-check" style="color: var(--primary-400); margin-top: 4px;"></i>
            <div><strong>Transparent Audit Trails:</strong> Municipal authorities can see exactly what the citizen submitted versus what the AI detected.</div>
          </li>
        </ul>
      </div>

      <!-- FAQ Section -->
      <div class="card" style="padding: 2.5rem;">
        <h3 style="font-size: 1.35rem; margin-bottom: 1.5rem;">Frequently Asked Questions</h3>

        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div>
            <h4 style="font-size: 1rem; color: var(--neutral-900); margin-bottom: 0.35rem;">What if the AI makes an incorrect category recommendation?</h4>
            <p style="font-size: 0.9rem; color: var(--neutral-600); line-height: 1.5;">You can easily click "Change Category" on Step 2 or select the correct domain directly on Step 3 of the reporting wizard.</p>
          </div>

          <div style="border-top: 1px solid var(--neutral-100); padding-top: 1.25rem;">
            <h4 style="font-size: 1rem; color: var(--neutral-900); margin-bottom: 0.35rem;">How does public report tracking work?</h4>
            <p style="font-size: 0.9rem; color: var(--neutral-600); line-height: 1.5;">Every submitted issue receives a human-friendly public ID like <code>CIV-2026-10482</code>. Anyone can track the status without requiring a login.</p>
          </div>

          <div style="border-top: 1px solid var(--neutral-100); padding-top: 1.25rem;">
            <h4 style="font-size: 1rem; color: var(--neutral-900); margin-bottom: 0.35rem;">What backend database powers CivicAI?</h4>
            <p style="font-size: 0.9rem; color: var(--neutral-600); line-height: 1.5;">CivicAI is built on Supabase (PostgreSQL with Row Level Security, Storage, Auth, and Realtime subscriptions) with local-first persistent fallback support.</p>
          </div>
        </div>
      </div>

    </div>
  `;
}
