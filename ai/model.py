"""
CivicAI Modular AI Model Loader
Supports loading custom Ultralytics YOLO models (e.g., ai/models/best.pt) or standard PyTorch models.
"""

import os
from typing import Optional

MODEL_PATH = os.getenv("CIVICAI_MODEL_PATH", "ai/models/best.pt")

class CivicVisionModel:
    _instance = None

    def __init__(self, model_path: str = MODEL_PATH):
        self.model_path = model_path
        self.model = None
        self._load_model()

    @classmethod
    def get_instance(cls, model_path: str = MODEL_PATH):
        if cls._instance is None:
            cls._instance = cls(model_path)
        return cls._instance

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                from ultralytics import YOLO
                self.model = YOLO(self.model_path)
                print(f"[CivicAI Model] Loaded custom YOLO weights from {self.model_path}")
            except ImportError:
                print("[CivicAI Model] Ultralytics not installed. Install via `pip install ultralytics`")
            except Exception as e:
                print(f"[CivicAI Model] Error loading {self.model_path}: {e}")
        else:
            print(f"[CivicAI Model] Weights file '{self.model_path}' not found. Using fallback vision heuristics.")

    def predict(self, image_input):
        if self.model is not None:
            results = self.model(image_input)
            return results
        return None
