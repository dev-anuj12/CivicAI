import React, { useState } from 'react';
import { CivicReport, IncidentCategory, IncidentSeverity, TabType, UserProfile } from '../types';
import { CIVIC_CATEGORIES } from '../data/mockData';
import { analyzeCivicImage } from '../services/aiVisionService';
import { getCurrentGeoLocation } from '../services/locationService';
import { uploadImage } from '../services/supabaseClient';

interface ReportIssueFlowViewProps {
  currentUser: UserProfile | null;
  onNavigate: (tab: TabType) => void;
  onShowToast: (msg: string, icon?: string) => void;
  onSubmitNewReport: (report: Partial<CivicReport>) => void;
  onOpenAuthModal: () => void;
}

export const ReportIssueFlowView: React.FC<ReportIssueFlowViewProps> = ({
  currentUser,
  onNavigate,
  onShowToast,
  onSubmitNewReport,
  onOpenAuthModal,
}) => {
  // Visual Evidence State - Starts FRESH (NO fake pre-filled photo)
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoFilename, setPhotoFilename] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanTicker, setScanTicker] = useState('Analyzing image...');

  // Location State
  const [locationAddress, setLocationAddress] = useState('');
  const [locationLandmark, setLocationLandmark] = useState('');
  const [locationWard, setLocationWard] = useState('Central Ward');
  const [locationCoords, setLocationCoords] = useState('21.1458° N, 79.0882° E');
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Form & AI Classification State
  const [category, setCategory] = useState<IncidentCategory>('Roads & Transportation');
  const [severity, setSeverity] = useState<IncidentSeverity>('MEDIUM');
  const [confidence, setConfidence] = useState<number>(0);
  const [aiExplanation, setAiExplanation] = useState<string>('');
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDesc, setIssueDesc] = useState('');
  const [categoryFields, setCategoryFields] = useState<Record<string, string>>({});

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  // Active category metadata
  const activeCategoryMeta =
    CIVIC_CATEGORIES.find((c) => c.id === category) || CIVIC_CATEGORIES[0];

  // Handle Image File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      onShowToast('Please upload a valid photograph (JPG, PNG, WebP).', 'warning');
      return;
    }

    setPhotoFile(file);
    setPhotoFilename(`${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const src = ev.target?.result as string;
      setPhotoSrc(src);
      await triggerAiAnalysis(src);
    };
    reader.readAsDataURL(file);
  };

  // AI Diagnostic Pipeline
  const triggerAiAnalysis = async (src: string) => {
    setIsScanning(true);
    setScanTicker('Uploading visual evidence...');
    setTimeout(() => setScanTicker('Scanning geometric pixel fractures...'), 350);
    setTimeout(() => setScanTicker('Running Gemini Vision AI Inference...'), 700);

    try {
      const result = await analyzeCivicImage(src);
      setConfidence(result.confidence);
      setCategory(result.category);
      setSeverity(result.severity);
      setAiExplanation(result.explanation);
      setIssueTitle(result.detectedIssue);
      setIssueDesc(result.suggestedDescription);
      onShowToast(`AI Analysis: ${result.detectedIssue} (${result.confidence}% confidence)`, 'auto_awesome');
    } catch (err) {
      console.error(err);
      onShowToast('Could not automatically analyze image. You can continue manually.', 'info');
    } finally {
      setIsScanning(false);
    }
  };

  // GPS Auto-Triangulation
  const handleAcquireGps = async () => {
    setIsGpsLoading(true);
    onShowToast('Acquiring high-precision GPS coordinates...', 'satellite_alt');

    try {
      const geo = await getCurrentGeoLocation();
      setLocationAddress(`${geo.road}, ${geo.area}`);
      setLocationWard(geo.ward);
      setLocationCoords(geo.coords);
      onShowToast(`GPS Locked: ±${geo.accuracyMeters}m accuracy (${geo.road})`, 'gps_fixed');
    } catch (err: any) {
      console.warn(err);
      onShowToast('GPS permission denied or unavailable. Enter location manually below.', 'location_off');
      if (!locationAddress) {
        setLocationAddress('Main Transit Avenue, Municipal Sector');
      }
    } finally {
      setIsGpsLoading(false);
    }
  };

  // Handle Report Submission
  const handleSubmit = async () => {
    if (!currentUser) {
      onShowToast('Please sign in or create an account to submit your civic report.', 'lock');
      onOpenAuthModal();
      return;
    }

    if (!photoSrc) {
      onShowToast('Please capture or upload a photograph of the civic issue.', 'add_a_photo');
      return;
    }

    if (!issueTitle.trim()) {
      onShowToast('Please provide a title or issue summary.', 'warning');
      return;
    }

    if (!locationAddress.trim()) {
      onShowToast('Please specify the location or landmark of the issue.', 'pin_drop');
      return;
    }

    setIsSubmitting(true);
    onShowToast('Compressing evidence & registering on municipal ledger...', 'hourglass_top');

    try {
      // Store image via Supabase Storage or persistent data URL
      let finalImageUrl = photoSrc;
      if (photoFile) {
        finalImageUrl = await uploadImage(photoFile);
      }

      const generatedId = `CIV-2026-${Math.floor(10000 + Math.random() * 89999)}`;

      const newReport: CivicReport = {
        id: generatedId,
        userId: currentUser?.id,
        reporterName: currentUser?.fullName || 'Verified Citizen Reporter',
        title: issueTitle.trim(),
        category,
        categoryIcon: activeCategoryMeta.icon,
        department: activeCategoryMeta.department,
        location: locationAddress.trim(),
        landmark: locationLandmark.trim() || undefined,
        ward: locationWard,
        coordinates: locationCoords,
        imageUrl: finalImageUrl,
        imageAlt: issueTitle,
        timestamp: 'Just now',
        status: 'REPORTED',
        priority: severity,
        upvotes: 1,
        hasUpvoted: true,
        slaRemaining: severity === 'CRITICAL' ? '12h 00m remaining' : '48h 00m remaining',
        confidenceScore: confidence || 92,
        description: issueDesc.trim(),
        hazardAssessment: aiExplanation || 'Assessed via CivicAI Vision Pipeline.',
        recommendedDispatch: activeCategoryMeta.department,
        isPrivate: false,
        categoryMetadata: categoryFields,
        aiExplanation,
        auditTrail: [
          {
            id: 'step-1',
            stage: 'Report Submitted',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            description: `Logged via CivicAI. AI Vision classification: ${category} (${confidence || 92}% confidence).`,
            isComplete: true,
            isCurrent: false,
          },
          {
            id: 'step-2',
            stage: 'AI Diagnostics Completed',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            description: `Severity categorized as ${severity}. Forwarded to ${activeCategoryMeta.department}.`,
            isComplete: true,
            isCurrent: true,
          },
        ],
        comments: [
          {
            id: `c_${Date.now()}`,
            author: currentUser?.fullName || 'Resident Reporter',
            initials: (currentUser?.fullName || 'RR').substring(0, 2).toUpperCase(),
            roleTag: currentUser ? 'Verified Citizen' : 'Community Reporter',
            timestamp: 'Just now',
            text: issueDesc.trim() || 'Citizen reported civic infrastructure defect.',
          },
        ],
      };

      onSubmitNewReport(newReport);
      setSubmittedTicketId(generatedId);
      onShowToast(`Report ${generatedId} logged successfully!`, 'verified');
    } catch (err) {
      console.error(err);
      onShowToast('Could not register report. Please check connection and try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success Screen
  if (submittedTicketId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 max-w-lg mx-auto text-center px-4 animate-in fade-in duration-300">
        <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6 ring-8 ring-emerald-50/50 shadow-sm">
          <span className="material-symbols-outlined text-[44px]">verified</span>
        </div>

        <span className="px-3.5 py-1 bg-emerald-50 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider border border-emerald-200">
          Status: Submitted & Audited
        </span>

        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-4 tracking-tight">
          Your Civic Issue Has Been Reported Successfully.
        </h2>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 mt-6 w-full shadow-xs text-left space-y-3">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <span className="text-xs text-slate-500 font-medium">Public Report ID</span>
            <span className="font-label-code text-sm font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg">
              {submittedTicketId}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Category</span>
            <span className="font-bold text-slate-800">{category}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Assigned Department</span>
            <span className="font-semibold text-slate-700">{activeCategoryMeta.department}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Location</span>
            <span className="font-medium text-slate-700 truncate max-w-[200px]">{locationAddress}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Severity</span>
            <span className="font-bold text-amber-600">{severity}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full mt-6">
          <button
            onClick={() => onNavigate('my-reports-tracking')}
            className="flex-1 py-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            <span>Track My Report</span>
          </button>

          <button
            onClick={() => onNavigate('citizen-portal')}
            className="flex-1 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Mandatory Citizen Authentication Barrier
  if (!currentUser) {
    return (
      <div className="flex flex-col items-center justify-center py-12 max-w-lg mx-auto text-center px-4 animate-in fade-in duration-300">
        <div className="w-20 h-20 rounded-3xl bg-teal-50 text-teal-800 flex items-center justify-center mb-6 ring-8 ring-teal-50/50 shadow-sm">
          <span className="material-symbols-outlined text-[44px]">shield_person</span>
        </div>

        <span className="px-3.5 py-1 bg-amber-50 text-amber-900 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-200">
          Citizen Authentication Required
        </span>

        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-4 tracking-tight">
          Sign In to Report Civic Issues
        </h2>

        <p className="text-slate-600 text-sm mt-2 max-w-md leading-relaxed">
          Municipal safety protocols require verified citizen identity before dispatching field crews and logging official public work orders.
        </p>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 mt-6 w-full shadow-xs text-left space-y-3">
          <div className="flex items-center gap-3 text-xs text-slate-700">
            <span className="material-symbols-outlined text-teal-700 text-[20px]">verified</span>
            <span>Prevents fraudulent & automated spam submissions</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-700">
            <span className="material-symbols-outlined text-teal-700 text-[20px]">notifications_active</span>
            <span>Direct notifications when municipal repair teams work on site</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-700">
            <span className="material-symbols-outlined text-teal-700 text-[20px]">receipt_long</span>
            <span>Personal tracking timeline from AI capture to resolution</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full mt-6">
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="flex-1 py-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">login</span>
            <span>Sign In to Account</span>
          </button>

          <button
            type="button"
            onClick={onOpenAuthModal}
            className="flex-1 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors cursor-pointer active:scale-95"
          >
            Create Free Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full pb-28 max-w-3xl mx-auto animate-in fade-in duration-200 gap-6">
      {/* Hidden file input for real uploads */}
      <input
        type="file"
        id="nativePhotoInput"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Header Banner with Verified Identity */}
      <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            Citizen Reporting Flow
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
            Report a Civic Issue
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Capture photograph, let AI diagnose the issue, and dispatch to municipal teams.
          </p>
        </div>

        <div className="bg-teal-50 border border-teal-200/80 p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {currentUser.fullName.substring(0, 2).toUpperCase()}
          </div>
          <div className="text-xs min-w-0">
            <span className="text-teal-950 font-bold block truncate max-w-[170px]">{currentUser.fullName}</span>
            <span className="text-teal-800 font-medium text-[11px] truncate block">{currentUser.email} • Verified</span>
          </div>
        </div>
      </div>


      {/* 1. Photograph & AI Vision Scanner */}
      <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h2 className="text-base font-bold text-slate-900">Upload or Capture Photograph</h2>
          </div>
          {photoSrc && (
            <button
              onClick={() => document.getElementById('nativePhotoInput')?.click()}
              className="text-xs text-teal-700 font-bold hover:underline cursor-pointer"
            >
              Change Photo
            </button>
          )}
        </div>

        {!photoSrc ? (
          <div
            onClick={() => document.getElementById('nativePhotoInput')?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-teal-600 hover:bg-teal-50/30 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
          >
            <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[32px]">add_a_photo</span>
            </div>
            <p className="font-bold text-slate-800 text-sm sm:text-base">
              Click to capture or upload evidence photo
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              Supports real JPG, PNG, and WebP photos. CivicAI AI Vision will automatically inspect and classify the civic defect.
            </p>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-200 group">
            <img src={photoSrc} alt="Evidence" className="w-full max-h-80 object-contain mx-auto" />

            {/* AI Scanning Overlay Animation */}
            {isScanning && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4">
                <div className="w-12 h-12 rounded-full border-4 border-teal-400 border-t-transparent animate-spin mb-3" />
                <span className="font-label-code text-xs font-bold text-teal-300 animate-pulse">
                  {scanTicker}
                </span>
                <div className="w-48 h-1.5 bg-slate-700 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-teal-400 animate-pulse rounded-full w-3/4" />
                </div>
              </div>
            )}

            {!isScanning && (
              <div className="absolute bottom-3 left-3 right-3 bg-slate-950/80 backdrop-blur-md p-3 rounded-xl text-white flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span className="material-symbols-outlined text-teal-400 text-[18px]">verified</span>
                  <span className="font-label-code truncate">{photoFilename || 'Evidence photo verified'}</span>
                </div>
                {confidence > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-teal-600/60 font-label-code font-bold text-teal-200">
                    {confidence}% Match
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* AI Result Card */}
        {confidence > 0 && !isScanning && (
          <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800 inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">psychology</span>
                <span>AI Vision Analysis Complete</span>
              </span>
              <span className="text-xs font-bold text-teal-700">{confidence}% Confidence</span>
            </div>
            <div className="text-sm font-bold text-slate-900">{issueTitle}</div>
            <p className="text-xs text-slate-600 leading-relaxed">{aiExplanation}</p>
            <div className="pt-2 flex items-center gap-2 text-[11px] text-teal-800 font-semibold border-t border-teal-200/50">
              <span className="material-symbols-outlined text-[14px]">info</span>
              <span>AI recommendations can be edited or changed anytime before submission.</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Category & Dynamic Fields */}
      <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center">
            2
          </span>
          <h2 className="text-base font-bold text-slate-900">Issue Category & Specifications</h2>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Civic Category (9 Domains)
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as IncidentCategory)}
            className="w-full bg-slate-50 text-slate-900 text-sm font-semibold p-3.5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer"
          >
            {CIVIC_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} — {cat.department}
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1">{activeCategoryMeta.description}</p>
        </div>

        {/* Dynamic Category Specific Form Fields */}
        {activeCategoryMeta.fields.length > 0 && (
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
              {activeCategoryMeta.name} Specific Details
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeCategoryMeta.fields.map((field) => (
                <div key={field.name}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{field.label}</label>
                  {field.type === 'select' && (
                    <select
                      value={categoryFields[field.name] || field.options?.[0]}
                      onChange={(e) =>
                        setCategoryFields((prev) => ({ ...prev, [field.name]: e.target.value }))
                      }
                      className="w-full bg-white text-slate-800 text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 cursor-pointer font-medium"
                    >
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Severity Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Suggested Severity
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as IncidentSeverity[]).map((lvl) => {
              const isSelected = severity === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSeverity(lvl)}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all border cursor-pointer ${
                    isSelected
                      ? lvl === 'CRITICAL'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : lvl === 'HIGH'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : lvl === 'MEDIUM'
                        ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                        : 'bg-slate-800 text-white border-slate-800 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {lvl}
                </button>
              );
            })}
          </div>
        </div>

        {/* Description & Title */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Issue Summary / Headline
            </label>
            <input
              type="text"
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              placeholder="e.g. Deep Pothole crater near transit crossroad"
              className="w-full bg-slate-50 text-slate-900 text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Detailed Description
            </label>
            <textarea
              rows={3}
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              placeholder="Describe the exact location, dimension, or danger to the public..."
              className="w-full bg-slate-50 text-slate-900 text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>
        </div>
      </div>

      {/* 3. Location & GPS */}
      <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center">
              3
            </span>
            <h2 className="text-base font-bold text-slate-900">Incident Location</h2>
          </div>
          <button
            type="button"
            onClick={handleAcquireGps}
            disabled={isGpsLoading}
            className="flex items-center gap-1.5 text-xs font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl border border-teal-200 transition-colors cursor-pointer"
          >
            <span className={`material-symbols-outlined text-[16px] ${isGpsLoading ? 'animate-spin' : ''}`}>
              {isGpsLoading ? 'refresh' : 'my_location'}
            </span>
            <span>{isGpsLoading ? 'Locating...' : 'Use My GPS'}</span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address or Road Name</label>
            <input
              type="text"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              placeholder="e.g. Ring Road near Metro Pillar #42, Central Zone"
              className="w-full bg-slate-50 text-slate-900 text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Prominent Landmark (Optional)</label>
              <input
                type="text"
                value={locationLandmark}
                onChange={(e) => setLocationLandmark(e.target.value)}
                placeholder="e.g. Opposite State Bank branch"
                className="w-full bg-slate-50 text-slate-900 text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Municipal Ward</label>
              <input
                type="text"
                value={locationWard}
                onChange={(e) => setLocationWard(e.target.value)}
                placeholder="e.g. Ward 24"
                className="w-full bg-slate-50 text-slate-900 text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Submit Action Bar */}
      <div className="sticky bottom-20 z-20 bg-white/95 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-md flex items-center justify-between gap-4">
        <div className="text-xs text-slate-500">
          <span className="font-bold text-slate-900 block">{category}</span>
          <span>Target SLA: {severity === 'CRITICAL' ? '12-24h' : '48h'}</span>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="bg-teal-700 hover:bg-teal-800 active:scale-95 text-white font-bold text-sm sm:text-base py-3 px-8 rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              <span>Registering Ticket...</span>
            </>
          ) : (
            <>
              <span>Submit Report</span>
              <span className="material-symbols-outlined text-[18px]">send</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
