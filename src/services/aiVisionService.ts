import { IncidentCategory, IncidentSeverity } from '../types';
import { detectCivicIssueFromImage, normalizeCivicCategory } from '../ai/detector';

export interface AiVisionResult {
  detectedIssue: string;
  category: IncidentCategory;
  subcategory: string;
  confidence: number;
  severity: IncidentSeverity;
  explanation: string;
  suggestedDescription: string;
  suggestedDispatch: string;
  hazardAssessment: string;
}

export async function analyzeCivicImage(imageSrc: string, filenameHint?: string): Promise<AiVisionResult> {
  const result = await detectCivicIssueFromImage(imageSrc, filenameHint);
  return {
    detectedIssue: result.detectedIssue,
    category: result.category,
    subcategory: result.subcategory,
    confidence: result.confidence,
    severity: result.severity,
    explanation: result.explanation,
    suggestedDescription: result.suggestedDescription,
    suggestedDispatch: result.suggestedDispatch,
    hazardAssessment: result.hazardAssessment,
  };
}
