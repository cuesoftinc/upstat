import numpy as np
import logging
from typing import List

logger = logging.getLogger(__name__)

class FeatureTransformer:
    """
    Convert raw MongoDB CheckResult records into feature vectors for ML models.
    Handles normalization and aggregation.
    
    Input: list of dicts with keys from Go CheckResults model:
      - responseTimeMs: int64
      - status: str ("up" or "down")
      - statusCode: int
      - attempts: int
      - error: str (optional)
    """
    
    def __init__(self):
        # Normalization parameters (learned from training data)
        self.response_time_mean = None
        self.response_time_std = None
        self.status_code_mean = None
        self.status_code_std = None
    
    def fit(self, checks: List[dict]) -> None:
        """
        Compute normalization statistics from training data.
        Call this once on historical data before using transform().
        """
        if not checks:
            logger.warning("No checks to fit. Using default normalization.")
            self.response_time_mean = 100
            self.response_time_std = 50
            self.status_code_mean = 200
            self.status_code_std = 100
            return
        
        response_times = [c.get("responseTimeMs", 0) for c in checks]
        status_codes = [c.get("statusCode", 200) for c in checks]
        
        self.response_time_mean = np.mean(response_times)
        self.response_time_std = np.std(response_times) or 1  # avoid division by zero
        self.status_code_mean = np.mean(status_codes)
        self.status_code_std = np.std(status_codes) or 1
        
        logger.info(
            f"Fitted transformer. Response time: μ={self.response_time_mean:.1f} σ={self.response_time_std:.1f}"
        )
    
    def transform(self, checks: List[dict]) -> np.ndarray:
        """
        Convert list of checks into a feature matrix (N x 6).
        Each row is one check; each column is a feature.
        
        Features:
        0. Raw response time (ms)
        1. Normalized response time (z-score)
        2. Success flag (1 if status=="up", 0 otherwise)
        3. Normalized status code
        4. Failure flag (1 - success)
        5. Attempts
        """
        if self.response_time_mean is None:
            raise ValueError("Transformer not fitted. Call fit() first.")
        
        if not checks:
            return np.array([]).reshape(0, 6)
        
        features = []
        for check in checks:
            response_time_ms = check.get("responseTimeMs", 0)
            status = check.get("status", "down")  # Go backend: "up" or "down"
            status_code = check.get("statusCode", 0)
            attempts = check.get("attempts", 1)
            
            # Normalize response time (z-score)
            response_time_normalized = (response_time_ms - self.response_time_mean) / self.response_time_std
            
            # Convert status string to binary
            success_flag = 1 if status == "up" else 0
            failure_flag = 1 - success_flag
            
            # Normalize status code
            status_code_normalized = (status_code - self.status_code_mean) / self.status_code_std
            
            # Build feature row
            feature_row = [
                float(response_time_ms),
                float(response_time_normalized),
                float(success_flag),
                float(status_code_normalized),
                float(failure_flag),
                float(attempts),
            ]
            features.append(feature_row)
        
        return np.array(features)
    
    def transform_single(self, check: dict) -> np.ndarray:
        """Transform a single check into a feature vector (1 x 6)."""
        return self.transform([check])
