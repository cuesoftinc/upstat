import numpy as np
import pickle
import os
import logging
from sklearn.ensemble import IsolationForest
from typing import List

logger = logging.getLogger(__name__)

class AnomalyDetectionModel:
    """
    Unsupervised anomaly detector using Isolation Forest.
    Learns normal behavior from historical check data and flags deviations.
    
    The model identifies checks that are "isolated" from the normal cluster,
    which indicates unusual response times, failures, or status codes.
    """
    
    def __init__(self, contamination: float = 0.1):
        """
        contamination: expected fraction of anomalies in training data (default 10%).
        Lower values = stricter anomaly detection. Higher values = more tolerant.
        """ 
        self.model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=100
        )
        self.is_trained = False
    
    def train(self, feature_matrix: np.ndarray) -> None:
        """
        Fit the Isolation Forest model on historical feature data.
        
        Args:
            feature_matrix: shape (N, 6) where N = number of checks
        """
        if feature_matrix.shape[0] < 10:
            raise ValueError(
                f"Insufficient training data. Got {feature_matrix.shape[0]} samples, need at least 10."
            )
        
        self.model.fit(feature_matrix)
        self.is_trained = True
        logger.info(f"Model trained on {feature_matrix.shape[0]} samples")
    
    def predict(self, feature_matrix: np.ndarray) -> np.ndarray:
        """
        Predict anomalies: -1 = anomaly (outlier), 1 = normal.
        
        Args:
            feature_matrix: shape (N, 6)
        
        Returns:
            array of -1 or 1
        """
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")
        return self.model.predict(feature_matrix)
    
    def predict_proba(self, feature_matrix: np.ndarray) -> np.ndarray:
        """
        Get anomaly scores. Lower = more anomalous.
        Score range: roughly [-∞, 0] with 0 being normal.
        
        Args:
            feature_matrix: shape (N, 6)
        
        Returns:
            array of anomaly scores
        """
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")
        return self.model.score_samples(feature_matrix)
    
    def save(self, filepath: str) -> None:
        """Persist the trained model to disk."""
        # Guard against path traversal: ``filepath`` is derived from a
        # user-provided monitor id upstream, so the resolved path must stay
        # inside the fixed model directory.
        base_dir = os.path.realpath("ml/models")
        real_path = os.path.realpath(filepath)
        if not real_path.startswith(base_dir + os.sep):
            raise ValueError(f"Refusing to save model outside {base_dir}: {filepath!r}")
        os.makedirs(os.path.dirname(real_path), exist_ok=True)
        with open(real_path, "wb") as f:
            pickle.dump(self.model, f)
        logger.info(f"Model saved to {filepath}")
    
    def load(self, filepath: str) -> None:
        """Load a trained model from disk."""
        with open(filepath, "rb") as f:
            self.model = pickle.load(f)
        self.is_trained = True
        logger.info(f"Model loaded from {filepath}")
