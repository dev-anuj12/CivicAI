"""
CivicAI Explainable Severity Module
"""

from typing import Dict, Any, List

def compute_severity(category: str, confidence: float, reports_count: int = 1, age_hours: float = 0.0) -> Dict[str, Any]:
    score = 50
    reasons: List[str] = []

    cat = category.lower()
    if "pothole" in cat or "road" in cat:
        score += 15
        reasons.append("Road surface defect poses immediate skidding risk to motorists")
    elif "water" in cat or "leak" in cat:
        score += 20
        reasons.append("Fluid leakage threatens ground erosion and water supply contamination")
    elif "tree" in cat:
        score += 15
        reasons.append("Fallen tree obstructs transit flow and utility lines")
    elif "light" in cat:
        score += 10
        reasons.append("Unlit area causes night-time safety hazards")
    elif "waste" in cat or "garbage" in cat:
        score += 10
        reasons.append("Solid waste creates public hygiene concerns")

    if reports_count >= 5:
        score += 20
        reasons.append(f"High community distress: {reports_count} independent reports filed")

    if age_hours >= 72:
        score += 15
        reasons.append("Pending resolution for over 72 hours")

    level = "MEDIUM"
    if score >= 80:
        level = "CRITICAL"
    elif score >= 65:
        level = "HIGH"
    elif score < 40:
        level = "LOW"

    return {
        "severity": level,
        "score": score,
        "reasons": reasons
    }
