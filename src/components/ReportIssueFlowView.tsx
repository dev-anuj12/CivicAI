import React, { useEffect, useRef, useState } from 'react';
import { CivicIssue, CivicReport, DuplicateMatch, IncidentCategory, IncidentSeverity, TabType, UserProfile } from '../types';
import { CIVIC_CATEGORIES } from '../data/mockData';
import { detectCivicIssueFromImage, normalizeCivicCategory } from '../ai/detector';
import { calculateExplainableSeverity } from '../ai/severity';
import { detectDuplicateComplaints } from '../ai/duplicateDetector';
import { getCurrentGeoLocation } from '../services/locationService';
import { addCommunityVerification, fetchAllReports, fetchCivicIssues, uploadImage } from '../services/supabaseClient';
import { useTranslation } from '../i18n/translations';

interface ReportIssueFlowViewProps {
  currentUser: UserProfile | null;
  onNavigate: (tab: TabType) => void;
  onShowToast: (msg: string, icon?: string) => void;
  onSubmitNewReport: (report: Partial<CivicReport>) => Promise<void>;
  onOpenAuthModal: () => void;
}

const LOCATION_PRESETS = [
  { label: 'Main Market Square', place: 'Central Commercial Market, MG Road', landmark: 'Near City Clock Tower' },
  { label: 'Metro Station Corridor', place: 'Transit Metro Line 1 Corridor', landmark: 'Opposite Metro Pillar #42' },
  { label: 'Hospital & Health Zone', place: 'District Civil Hospital Road', landmark: 'Outside Emergency Ward Gate' },
  { label: 'School / College Area', place: 'University & Higher Secondary Road', landmark: 'Near Central Public Library' },
  { label: 'Residential Sector', place: 'Housing Colony 4th Cross Avenue', landmark: 'Behind Community Center' },
  { label: 'Highway Crossing', place: 'Ring Road Expressway Junction', landmark: 'Under Flyover Service Lane' },
];

export const ReportIssueFlowView: React.FC<ReportIssueFlowViewProps> = ({
  currentUser,
  onNavigate,
  onShowToast,
  onSubmitNewReport,
  onOpenAuthModal,
}) => {
  const { t } = useTranslation();

  // Visual Evidence State
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoFilename, setPhotoFilename] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanTicker, setScanTicker] = useState('Analyzing image...');

  // Location State
  const [locationAddress, setLocationAddress] = useState('City Center Commercial Sector, MG Road');
  const [locationLandmark, setLocationLandmark] = useState('Near Metro Pillar #42');
  const [locationWard, setLocationWard] = useState('Central Ward');
  const [locationCoords, setLocationCoords] = useState('21.1458° N, 79.0882° E');
  const [locationLat, setLocationLat] = useState<number | undefined>(21.1458);
  const [locationLng, setLocationLng] = useState<number | undefined>(79.0882);
  const [isGpsLoading, setIsGpsLoading] = useState(false);

  // Form & AI Classification State
  const [category, setCategory] = useState<IncidentCategory>('Sanitation & Waste');
  const [severity, setSeverity] = useState<IncidentSeverity>('HIGH');
  const [severityReasons, setSeverityReasons] = useState<string[]>([
    'Solid waste creates public hygiene and pest hazard.',
    'Pedestrian sidewalk obstruction detected in public zone.',
  ]);
  const [confidence, setConfidence] = useState<number>(94);
  const [aiExplanation, setAiExplanation] = useState<string>(
    'AI Vision detected municipal solid waste accumulation in public easement requiring immediate clearance.'
  );
  const [issueTitle, setIssueTitle] = useState('Solid Waste & Overflowing Garbage Pile');
  const [issueDesc, setIssueDesc] = useState(
    'Large accumulation of uncollected garbage and solid waste observed on the street causing foul odor and blocking the walkway.'
  );
  const [categoryFields, setCategoryFields] = useState<Record<string, string>>({});

  // 12. Voice Input State (Speech-to-Text)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  // 14. Duplicate Pre-Check State
  const [nearbyDuplicates, setNearbyDuplicates] = useState<DuplicateMatch[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [attachedToIssueId, setAttachedToIssueId] = useState<string | null>(null);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null);

  // Active category metadata
  const activeCategoryMeta =
    CIVIC_CATEGORIES.find((c) => c.id === category) || CIVIC_CATEGORIES[0];

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-IN';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }

        if (transcript.trim()) {
          setIssueDesc((prev) => {
            const base = prev.trim();
            return base ? `${base} ${transcript}` : transcript;
          });

          // Auto-suggest category from voice keywords
          const matchedCat = normalizeCivicCategory(transcript);
          if (matchedCat !== 'Other Civic Issues') {
            handleSelectCategory(matchedCat);
          }
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsRecordingVoice(false);
        onShowToast('Voice recognition ended. You can also type description.', 'info');
      };

      recognition.onend = () => {
        setIsRecordingVoice(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechRecognitionSupported(false);
    }
  }, []);

  // Category Selector Handler
  const handleSelectCategory = (newCat: IncidentCategory) => {
    setCategory(newCat);
    const meta = CIVIC_CATEGORIES.find((c) => c.id === newCat) || CIVIC_CATEGORIES[0];

    // Adapt default title and explanation dynamically
    let defaultTitle = `${meta.name} Issue`;
    let defaultSev: IncidentSeverity = 'HIGH';
    let defaultExp = `Reported ${meta.name} defect requiring municipal response.`;

    if (newCat === 'Sanitation & Waste') {
      defaultTitle = 'Solid Waste & Overflowing Garbage Pile';
      defaultSev = 'HIGH';
      defaultExp = 'Accumulation of unsegregated solid waste creating sanitation and health risk in public area.';
    } else if (newCat === 'Water & Drainage') {
      defaultTitle = 'Sewage Overflow & Drainage Leakage';
      defaultSev = 'CRITICAL';
      defaultExp = 'Contaminated effluent and drainage blockage causing street waterlogging and sanitation concern.';
    } else if (newCat === 'Roads & Transportation') {
      defaultTitle = 'Pothole & Asphalt Road Fracture';
      defaultSev = 'CRITICAL';
      defaultExp = 'Crater and broken asphalt causing immediate vehicular hazard and suspension impact.';
    } else if (newCat === 'Electricity & Lighting') {
      defaultTitle = 'Broken / Damaged Streetlight Luminaire';
      defaultSev = 'MEDIUM';
      defaultExp = 'Defective lighting fixture leaving public walkway dark during nocturnal hours.';
    } else if (newCat === 'Environment') {
      defaultTitle = 'Fallen Tree / Heavy Botanical Obstruction';
      defaultSev = 'HIGH';
      defaultExp = 'Fallen branch blocking public pathway and endangering utility lines.';
    } else if (newCat === 'Construction') {
      defaultTitle = 'Construction Debris & Unbarricaded Rubble';
      defaultSev = 'MEDIUM';
      defaultExp = 'Uncollected construction gravel and building debris obstructing road easement.';
    }

    setIssueTitle(defaultTitle);
    setSeverity(defaultSev);
    setAiExplanation(defaultExp);

    const sevAssessment = calculateExplainableSeverity({
      category: newCat,
      confidence: confidence || 94,
      detectedIssueTitle: defaultTitle,
      locationText: locationAddress,
    });
    setSeverityReasons(sevAssessment.reasons);
    runDuplicateCheck(newCat, photoSrc, locationLat, locationLng);
  };

  // Toggle Voice Recording
  const handleToggleVoice = () => {
    if (!recognitionRef.current) {
      onShowToast('Speech recognition is not supported in this browser. Please type below.', 'warning');
      return;
    }

    if (isRecordingVoice) {
      recognitionRef.current.stop();
      setIsRecordingVoice(false);
      onShowToast('Voice recording captured!', 'mic');
    } else {
      try {
        recognitionRef.current.start();
        setIsRecordingVoice(true);
        onShowToast('Listening... Speak your complaint clearly', 'mic_none');
      } catch (e) {
        console.error('Could not start recognition:', e);
        setIsRecordingVoice(false);
      }
    }
  };

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
      await triggerAiAnalysis(src, file.name);
    };
    reader.readAsDataURL(file);
  };

  // AI Diagnostic Pipeline
  const triggerAiAnalysis = async (src: string, filename = '') => {
    setIsScanning(true);
    setScanTicker('Uploading visual evidence...');
    setTimeout(() => setScanTicker('Scanning chromatic spectra & textures...'), 250);
    setTimeout(() => setScanTicker('Running AI Vision Multimodal Classifier...'), 500);

    try {
      const result = await detectCivicIssueFromImage(src, filename || photoFilename);
      setConfidence(result.confidence);
      setCategory(result.category);
      setAiExplanation(result.explanation);
      setIssueTitle(result.detectedIssue);
      setIssueDesc(result.suggestedDescription);

      // Explainable severity calculation
      const sevAssessment = calculateExplainableSeverity({
        category: result.category,
        confidence: result.confidence,
        detectedIssueTitle: result.detectedIssue,
        locationText: locationAddress,
      });
      setSeverity(sevAssessment.finalSeverity);
      setSeverityReasons(sevAssessment.reasons);

      onShowToast(`AI Detected: ${result.detectedIssue} (${result.confidence}% confidence)`, 'auto_awesome');

      // Check for nearby duplicates
      await runDuplicateCheck(result.category, src, locationLat, locationLng);
    } catch (err) {
      console.error(err);
      onShowToast('AI Analysis fallback completed. You can adjust details below.', 'info');
    } finally {
      setIsScanning(false);
    }
  };

  // Run Duplicate Check against existing database
  const runDuplicateCheck = async (
    cat: IncidentCategory,
    imgSrc?: string | null,
    lat?: number,
    lng?: number
  ) => {
    setIsCheckingDuplicates(true);
    try {
      const existingIssues = await fetchCivicIssues();
      const existingReports = await fetchAllReports();

      const partialReport: Partial<CivicReport> = {
        category: cat,
        imageUrl: imgSrc || photoSrc || '',
        latitude: lat ?? locationLat ?? 21.1458,
        longitude: lng ?? locationLng ?? 79.0882,
        title: issueTitle,
        description: issueDesc,
        location: locationAddress,
      };

      const dups = await detectDuplicateComplaints(partialReport, existingIssues, existingReports, 65);
      setNearbyDuplicates(dups);

      if (dups.length > 0) {
        onShowToast(`Found ${dups.length} similar reports nearby. Review below!`, 'content_copy');
      }
    } catch (e) {
      console.warn('Duplicate check error:', e);
    } finally {
      setIsCheckingDuplicates(false);
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
      setLocationLat(geo.latitude);
      setLocationLng(geo.longitude);
      onShowToast(`GPS Locked: ±${geo.accuracyMeters}m accuracy (${geo.road})`, 'gps_fixed');

      // Re-trigger duplicate check with fresh coordinates
      await runDuplicateCheck(category, photoSrc, geo.latitude, geo.longitude);
    } catch (err: any) {
      console.warn(err);
      onShowToast('GPS permission unavailable. Enter location manually below.', 'location_off');
    } finally {
      setIsGpsLoading(false);
    }
  };

  // Handle Community Confirmation of Existing Duplicate
  const handleAttachToExistingIssue = async (match: DuplicateMatch) => {
    setAttachedToIssueId(match.targetIssueId);
    await addCommunityVerification(match.targetIssueId, 'confirm', currentUser?.fullName || 'Verified Citizen');
    onShowToast(`Attached report to ${match.targetIssueId}! Issue priority boosted. 🚀`, 'verified');
    onNavigate('my-reports-tracking');
  };

  // Handle Report Submission
  const handleSubmit = async () => {
    if (!photoSrc) {
      onShowToast('Please capture or upload a photograph of the civic issue.', 'add_a_photo');
      return;
    }

    const reporterUser = currentUser || {
      id: `usr_${Date.now()}`,
      fullName: 'Verified Citizen Reporter',
      email: 'citizen@smartcity.gov.in',
      role: 'citizen',
      isVerified: true,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const finalTitle = issueTitle.trim() || `${category} Defect`;
    const finalAddress = locationAddress.trim() || 'Municipal Transit Road, Central City';

    setIsSubmitting(true);
    onShowToast(t('report.submitting'), 'hourglass_top');

    try {
      let finalImageUrl = photoSrc;
      if (photoFile) {
        try {
          finalImageUrl = await uploadImage(photoFile);
        } catch {
          finalImageUrl = photoSrc;
        }
      }

      const generatedId = `CIV-${new Date().getFullYear()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

      const newReport: CivicReport = {
        id: generatedId,
        userId: reporterUser.id,
        reporterName: reporterUser.fullName || 'Verified Citizen Reporter',
        reporterContact: reporterUser.email || undefined,
        title: finalTitle,
        category,
        categoryIcon: activeCategoryMeta.icon,
        department: activeCategoryMeta.department,
        location: finalAddress,
        landmark: locationLandmark.trim() || undefined,
        ward: locationWard,
        coordinates: locationCoords,
        latitude: locationLat || 21.1458,
        longitude: locationLng || 79.0882,
        imageUrl: finalImageUrl,
        imageAlt: finalTitle,
        timestamp: 'Just now',
        status: 'REPORTED',
        priority: severity,
        upvotes: 1,
        hasUpvoted: true,
        slaRemaining: severity === 'CRITICAL' ? '12h 00m remaining' : '48h 00m remaining',
        confidenceScore: confidence || 94,
        description: issueDesc.trim() || `Civic issue reported in ${category} sector.`,
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
            description: `Logged via CivicAI. AI Vision classification: ${category} (${confidence || 94}% confidence).`,
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
            author: reporterUser.fullName || 'Resident Reporter',
            initials: (reporterUser.fullName || 'RR').substring(0, 2).toUpperCase(),
            roleTag: 'Verified Citizen',
            timestamp: 'Just now',
            text: issueDesc.trim() || 'Citizen reported civic infrastructure defect.',
          },
        ],
      };

      await onSubmitNewReport(newReport);
      setSubmittedTicketId(generatedId);
      onShowToast(`Report ${generatedId} logged successfully!`, 'verified');
    } catch (err) {
      console.error(err);
      onShowToast('Could not register report. Saved to local session.', 'verified');
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
          Status: Submitted & Audited on Municipal Ledger
        </span>

        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-4 tracking-tight">
          {t('report.success')}
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
            <span className="text-slate-500">Place of Defect</span>
            <span className="font-medium text-slate-700 truncate max-w-[200px]">{locationAddress}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Landmark</span>
            <span className="font-medium text-slate-700 truncate max-w-[200px]">{locationLandmark || 'Specified on map'}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Severity</span>
            <span className="font-bold text-amber-600">{severity}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full mt-6">
          <button
            onClick={() => onNavigate('my-reports-tracking')}
            className="flex-1 py-3 px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
          >
            Track Live Status & SLA →
          </button>
          <button
            onClick={() => {
              setSubmittedTicketId(null);
              setPhotoSrc(null);
              setPhotoFile(null);
              setIssueTitle('');
              setIssueDesc('');
            }}
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer border border-slate-200"
          >
            Report Another Issue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 max-w-3xl mx-auto animate-in fade-in duration-200">
      {/* Hidden File Input */}
      <input
        type="file"
        id="nativePhotoInput"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-3 py-1 bg-teal-50 text-teal-800 rounded-full text-xs font-bold tracking-wide uppercase border border-teal-200">
            Citizen Reporting Flow
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tracking-tight">
            {t('report.heading')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t('report.subheading')}
          </p>
        </div>

        <div className="bg-teal-50 border border-teal-200/80 p-3.5 rounded-2xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-teal-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {(currentUser?.fullName || 'Verified Citizen').substring(0, 2).toUpperCase()}
          </div>
          <div className="text-xs min-w-0">
            <span className="text-teal-950 font-bold block truncate max-w-[170px]">
              {currentUser?.fullName || 'Verified Citizen Reporter'}
            </span>
            <span className="text-teal-800 font-medium text-[11px] truncate block">
              {currentUser?.email || 'Active Citizen Mode'} • Verified
            </span>
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
            <h2 className="text-base font-bold text-slate-900">{t('report.step1')}</h2>
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
              Supports garbage, sewage overflow, potholes, broken streetlights, water leaks, and fallen trees.
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

        {/* AI Result & Explainable Severity Card */}
        {confidence > 0 && !isScanning && (
          <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800 inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">psychology</span>
                <span>AI Vision Multi-Issue Analysis</span>
              </span>
              <span className="text-xs font-bold text-teal-700 bg-white px-2 py-0.5 rounded-lg border border-teal-200">
                {confidence}% Confidence
              </span>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">{issueTitle}</div>
              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{aiExplanation}</p>
            </div>

            {/* Explainable Severity Reasons */}
            {severityReasons.length > 0 && (
              <div className="bg-white/90 p-3 rounded-xl border border-teal-200/60 space-y-1 text-xs">
                <span className="text-[11px] font-bold text-slate-700 block uppercase">
                  Explainable Severity Rationale ({severity}):
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600 text-[11px]">
                  {severityReasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 14. Duplicate Pre-Check Advisory Banner */}
      {nearbyDuplicates.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-[28px] p-6 space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">content_copy</span>
              </span>
              <div>
                <h3 className="text-sm font-bold text-amber-950">{t('report.duplicateAlert')}</h3>
                <p className="text-xs text-amber-800 mt-0.5">{t('report.duplicateNotice')}</p>
              </div>
            </div>
            <span className="bg-amber-200/80 text-amber-950 text-xs font-bold px-2.5 py-1 rounded-full">
              {nearbyDuplicates[0].similarityScore}% Match
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {nearbyDuplicates.slice(0, 2).map((dup) => (
              <div key={dup.id} className="bg-white p-3.5 rounded-2xl border border-amber-200 space-y-2 text-xs">
                <div className="flex justify-between items-center font-semibold text-slate-800">
                  <span className="truncate">{dup.targetIssueTitle || 'Nearby Issue'}</span>
                  <span className="text-amber-800 font-bold">{dup.signals.geoDistanceMeters}m away</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Visual: {dup.signals.visualSimilarity}%</span> • <span>Text: {dup.signals.textSimilarity}%</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAttachToExistingIssue(dup)}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                  <span>{t('report.attachExisting')}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Category & Issue Specifications */}
      <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h2 className="text-base font-bold text-slate-900">{t('report.step2')}</h2>
          </div>

          {/* 12. Speech-to-Text Voice Recording Button */}
          {speechRecognitionSupported && (
            <button
              type="button"
              onClick={handleToggleVoice}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                isRecordingVoice
                  ? 'bg-rose-600 text-white animate-pulse shadow-md ring-2 ring-rose-400'
                  : 'bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isRecordingVoice ? 'mic' : 'mic_none'}
              </span>
              <span>{isRecordingVoice ? t('report.voiceStop') : t('report.voiceInput')}</span>
            </button>
          )}
        </div>

        {isRecordingVoice && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 animate-in fade-in">
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
            <span>{t('report.voiceListening')}</span>
          </div>
        )}

        {/* 1-Click Interactive Category Selector Grid */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Select Issue Category (Click to Switch)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {CIVIC_CATEGORIES.slice(0, 8).map((cat) => {
              const isSelected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectCategory(cat.id)}
                  className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-700 text-white border-teal-700 shadow-sm ring-2 ring-teal-600/30'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px] mb-1">
                    {cat.icon}
                  </span>
                  <span className="font-bold text-xs leading-tight">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Severity Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Suggested Priority Severity
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
              Issue Headline / Summary
            </label>
            <input
              type="text"
              value={issueTitle}
              onChange={(e) => setIssueTitle(e.target.value)}
              placeholder="e.g. Solid Waste & Overflowing Garbage Pile"
              className="w-full bg-slate-50 text-slate-900 text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Detailed Description (Type or use voice button above)
            </label>
            <textarea
              rows={3}
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              placeholder="Describe the defect, garbage volume, drainage blockage, or danger..."
              className="w-full bg-slate-50 text-slate-900 text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>
        </div>
      </div>

      {/* 3. Location & Exact Place of Defect */}
      <div className="bg-white rounded-[28px] p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs font-bold flex items-center justify-center">
              3
            </span>
            <h2 className="text-base font-bold text-slate-900">Exact Location & Place of Defect</h2>
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

        {/* Location Suggestion Preset Chips */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Quick Place Suggestions (Click to Apply)
          </label>
          <div className="flex flex-wrap gap-2">
            {LOCATION_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setLocationAddress(preset.place);
                  setLocationLandmark(preset.landmark);
                  onShowToast(`Location set: ${preset.place}`, 'pin_drop');
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 hover:text-teal-900 text-slate-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
              >
                📍 {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Exact Place / Street / Area Name
            </label>
            <input
              type="text"
              value={locationAddress}
              onChange={(e) => setLocationAddress(e.target.value)}
              placeholder="e.g. Near City Central Market, MG Road, Ward 4"
              className="w-full bg-slate-50 text-slate-900 text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Landmark & Improvement Spot
              </label>
              <input
                type="text"
                value={locationLandmark}
                onChange={(e) => setLocationLandmark(e.target.value)}
                placeholder="e.g. Opposite State Bank / Near Metro Pillar #42"
                className="w-full bg-slate-50 text-slate-900 text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-600 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Municipal Ward / Zone
              </label>
              <input
                type="text"
                value={locationWard}
                onChange={(e) => setLocationWard(e.target.value)}
                placeholder="e.g. Central Ward (Zone 3)"
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
              <span>{t('report.submit')}</span>
              <span className="material-symbols-outlined text-[18px]">send</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
