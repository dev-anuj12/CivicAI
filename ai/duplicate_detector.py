"""
CivicAI Multi-Signal Duplicate Detection Module
"""

import math
from typing import Dict, Any, List

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0  # Earth radius in meters
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 1)

def check_duplicate(report: Dict[str, Any], existing_reports: List[Dict[str, Any]], threshold: float = 70.0) -> List[Dict[str, Any]]:
    matches = []
    lat1 = report.get("latitude", 21.1458)
    lon1 = report.get("longitude", 79.0882)
    cat1 = report.get("category", "").lower()

    for item in existing_reports:
        if item.get("id") == report.get("id"):
            continue
        lat2 = item.get("latitude", 21.1458)
        lon2 = item.get("longitude", 79.0882)
        dist = haversine_distance(lat1, lon1, lat2, lon2)
        cat2 = item.get("category", "").lower()
        
        category_match = cat1 == cat2
        geo_score = 100 if dist <= 30 else 80 if dist <= 75 else 50 if dist <= 150 else 0
        total_sim = round(geo_score * 0.6 + (100 if category_match else 20) * 0.4)

        if total_sim >= threshold and dist <= 200:
            matches.append({
                "target_id": item.get("id"),
                "similarity_score": total_sim,
                "distance_meters": dist,
                "category_match": category_match
            })
    
    return sorted(matches, key=lambda x: x["similarity_score"], reverse=True)
