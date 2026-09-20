"""
CivicAI Report Integrity Module
"""

from typing import Dict, Any, List

def check_integrity(report: Dict[str, Any], user_history: List[Dict[str, Any]]) -> Dict[str, Any]:
    flags: List[str] = []
    score = 95

    recent_hour_count = len(user_history)
    if recent_hour_count >= 5:
        score -= 40
        flags.append("Elevated velocity: >5 reports submitted in last hour")
    elif recent_hour_count >= 3:
        score -= 20
        flags.append("High reporting frequency")

    status = "NORMAL"
    if score < 50:
        status = "FLAGGED"
    elif score < 75 or len(flags) > 0:
        status = "REVIEW"

    return {
        "status": status,
        "integrity_score": score,
        "flags": flags or ["Standard integrity passed"]
    }
