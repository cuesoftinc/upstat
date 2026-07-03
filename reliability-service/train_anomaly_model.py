#!/usr/bin/env python3
"""
Standalone script to train and save the anomaly detection model.

This script:
1. Loads historical check data from MongoDB (Go backend writes here)
2. Extracts features from the raw checks
3. Trains an Isolation Forest model
4. Saves the model and transformer to disk for later inference

Usage:
    python train_anomaly_model.py <monitor_id>
    python train_anomaly_model.py 6a2c342367d7434a69e89a63

Requirements:
    - MongoDB must be running (MONGO_URI env var)
    - Monitor must have at least 20 historical checks
    - Takes 2-5 seconds per monitor
"""

import sys
import os
import logging
from pathlib import Path

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

from ml.data_loader import load_historical_data
from ml.feature_transformer import FeatureTransformer
from ml.anomaly_model import AnomalyDetectionModel


def train_model_for_monitor(monitor_id: str, days_back: int = 14):
    """
    Train and save a model for a specific monitor.
    
    Strategy: try 14 days first, then gracefully degrade to 7, 3, or 1 day
    if insufficient data. Requires minimum 20 checks.
    """
    
    print(f"\n{'='*60}")
    print(f"Training anomaly model for monitor: {monitor_id}")
    print(f"{'='*60}")
    
    print(f"\n[1] Loading historical check data...")
    
    # Graceful degradation: try different time windows
    attempts = [(14, "14 days"), (7, "7 days"), (3, "3 days"), (1, "1 day")]
    checks = []
    actual_days = None
    
    for days, label in attempts:
        checks, _ = load_historical_data(monitor_id, days_back=days)
        if len(checks) >= 20:
            actual_days = label
            logger.info(f"   ✓ Found {len(checks)} checks using {label}")
            break
        logger.info(f"   ✗ Only {len(checks)} checks in {label}, trying shorter window...")
    
    # Final validation
    if not checks or len(checks) < 20:
        print(f"\n❌ FAILED: Insufficient data")
        print(f"   Got {len(checks)} checks, need at least 20.")
        print(f"   Recommendation: wait for monitor to collect more history, then retry.")
        return False
    
    print(f"   Using {len(checks)} checks ({actual_days})\n")
    
    # Fit feature transformer
    print(f"[2] Extracting and normalizing features...")
    transformer = FeatureTransformer()
    transformer.fit(checks)
    feature_matrix = transformer.transform(checks)
    print(f"   ✓ Feature matrix shape: {feature_matrix.shape}")
    print(f"   ✓ Features: [response_time_ms, response_time_norm, success, status_code_norm, failure, attempts]\n")
    
    # Train model
    print(f"[3] Training Isolation Forest model...")
    model = AnomalyDetectionModel(contamination=0.1)
    try:
        model.train(feature_matrix)
        print(f"   ✓ Model trained successfully\n")
    except ValueError as e:
        print(f"   ❌ {e}")
        return False
    
    # Save artifacts
    print(f"[4] Saving model and transformer to disk...")
    model_dir = Path("ml/models")
    model_dir.mkdir(parents=True, exist_ok=True)
    
    model_path = model_dir / f"{monitor_id}_anomaly_model.pkl"
    transformer_path = model_dir / f"{monitor_id}_transformer.pkl"
    
    model.save(str(model_path))
    
    import pickle
    with open(transformer_path, "wb") as f:
        pickle.dump(transformer, f)
    print(f"   ✓ Transformer saved to {transformer_path}\n")
    
    print(f"{'='*60}")
    print(f"✓ TRAINING COMPLETE")
    print(f"{'='*60}")
    print(f"Model saved to:       {model_path}")
    print(f"Transformer saved to: {transformer_path}")
    print(f"\nThe model is now ready for inference.")
    print(f"Use MLAnomalyDetector('{monitor_id}') to load and predict.\n")
    
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python train_anomaly_model.py <monitor_id>")
        print("Example: python train_anomaly_model.py 6a2c342367d7434a69e89a63")
        sys.exit(1)
    
    monitor_id = sys.argv[1]
    success = train_model_for_monitor(monitor_id, days_back=14)
    sys.exit(0 if success else 1)
