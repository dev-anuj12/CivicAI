"""
CivicAI Explainable Priority Engine
"""

from typing import Dict, Any, List

def compute_priority(severity: str, reports_count: int, age_hours: float, verifications_count: int = 0) -> Dict[str, Any]:
    score = 30
    reasons: List[str] = []

    sev = severity.upper()
    if sev == "CRITICAL":
        score += 35
        reasons.append("CRITICAL severity visual anomaly confirmed")
    elif sev == "HIGH":
        score += 25
        reasons.append("HIGH severity public danger")
    elif sev == "MEDIUM":
        score += 15
        reasons.append("MEDIUM severity municipal defect")
    else:
        score += 5
        reasons.append("LOW severity non-urgent upkeep")

    if reports_count >= 10:
        score += 25
        reasons.append(f"Widespread community distress: {reports_count} reports filed")
    elif reports_count >= 3:
        score += 15
        reasons.append(f"{reports_count} reports filed for this location")

    if age_hours >= 72:
        score += 25
        reasons.append(f"Breached 72-hour SLA window ({int(age_hours / 24)} days pending)")
    elif age_hours >= 24:
        score += 15
        reasons.append(f"Unresolved for {int(age_hours)} hours")

    if verifications_count >= 5:
        score += 15
        reasons.append(f"{verifications_count} citizen verifications confirmed issue")

    score = min(100, max(10, score))
    tier = "URGENT" if score >= 80 else "HIGH" if score >= 65 else "MEDIUM" if score >= 40 else "LOW"

    return {
        "priority": tier,
        "score": score,
        "reasons": reasons
    }
