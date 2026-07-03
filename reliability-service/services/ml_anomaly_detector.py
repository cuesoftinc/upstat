import os
import pickle
import logging
from pathlib import Path
import numpy as np
from dataclasses import asdict, is_dataclass

from ml.model_manager import ensure_model_exists

logger = logging.getLogger(__name__)


class MLAnomalyDetector:
    """
    Load pre-trained anomaly detection model and use it for predictions at inference time.
    Called during insight generation to detect if recent checks are anomalous.
    
    Usage:
        detector = MLAnomalyDetector("monitor-id")
        result = detector.predict_anomaly(list_of_checks)
        # result = {"is_anomaly": bool, "anomaly_score": float (0-1)}
    """
    
    def __init__(self, monitor_id: str):
        self.monitor_id = monitor_id
        self.model = None
        self.transformer = None
        self._load_model()
    
    def _load_model(self):
        """Load model and transformer from disk, if they exist. Attempt to train if missing."""
        model_dir = Path("ml/models")
        model_path = model_dir / f"{self.monitor_id}_anomaly_model.pkl"
        transformer_path = model_dir / f"{self.monitor_id}_transformer.pkl"
        
        # Try to ensure model exists (train if necessary)
        if not ensure_model_exists(self.monitor_id):
            logger.warning(
                f"No trained model found for monitor {self.monitor_id} and insufficient data to train. "
                f"Fallback to heuristic detection. Run: python train_anomaly_model.py {self.monitor_id}"
            )
            return False
        
        try:
            with open(model_path, "rb") as f:
                self.model = pickle.load(f)
            with open(transformer_path, "rb") as f:
                self.transformer = pickle.load(f)
            logger.info(f"Loaded anomaly model for {self.monitor_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False
    
    def predict_anomaly(self, checks: list) -> dict:
        """
        Predict if recent checks indicate an anomaly.
        
        Args:
            checks: list of check dicts from Go backend with keys:
                - responseTimeMs
                - status ("up" or "down")
                - statusCode
                - attempts
        
        Returns:
            {
                "is_anomaly": bool,
                "anomaly_score": float (0-1, where 1 = highly anomalous)
            }
        """
        # Fallback if model not loaded
        if self.model is None or self.transformer is None:
            logger.debug(f"Model not available for {self.monitor_id}, returning neutral prediction")
            return {"is_anomaly": False, "anomaly_score": 0.0}
        
        if not checks:
            logger.warning("No checks provided for anomaly detection")
            return {"is_anomaly": False, "anomaly_score": 0.0}
        
        try:
            # Transform checks to feature matrix
            feature_matrix = self.transformer.transform([
                self._check_to_feature_dict(check)
                for check in checks
            ])
            
            # Get prediction and score for the most recent check (last row)
            recent_check_features = feature_matrix[-1:]
            
            # Prediction: -1 = anomaly, 1 = normal
            prediction = self.model.predict(recent_check_features)[0]
            
            # Anomaly score: lower = more anomalous
            # IsolationForest uses score_samples(), not predict_proba()
            score = self.model.score_samples(recent_check_features)[0]
            
            # Convert to 0-1 scale where 1 = highly anomalous
            # Isolation Forest scores range roughly from -0.3 to 0.0
            # We normalize: 0.0 -> 0.0 (normal), -0.3 -> 1.0 (anomalous)
            anomaly_score = max(0.0, min(1.0, -score / 0.3))
            
            is_anomaly = bool(prediction == -1)
            
            logger.debug(
                f"Monitor {self.monitor_id}: "
                f"prediction={prediction}, raw_score={score:.3f}, normalized_score={anomaly_score:.3f}"
            )
            
            return {
                "is_anomaly": is_anomaly,
                "anomaly_score": float(anomaly_score)
            }
        
        except Exception as e:
            logger.error(f"Prediction failed for {self.monitor_id}: {e}")
            return {"is_anomaly": False, "anomaly_score": 0.0}

    def _check_to_feature_dict(self, check) -> dict:
        if isinstance(check, dict):
            return check

        if is_dataclass(check):
            check = asdict(check)

        return {
            "responseTimeMs": getattr(check, "response_time_ms", 0) if not isinstance(check, dict) else check.get("response_time_ms", 0),
            "status": "up" if (getattr(check, "success", False) if not isinstance(check, dict) else check.get("success", False)) else "down",
            "statusCode": getattr(check, "status_code", 0) if not isinstance(check, dict) else check.get("status_code", 0),
            "attempts": getattr(check, "attempts", 1) if not isinstance(check, dict) else check.get("attempts", 1),
        }
