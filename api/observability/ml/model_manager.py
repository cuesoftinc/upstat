"""
On-demand anomaly model training and loading.

If a trained model doesn't exist for a monitor, automatically train it from 
historical data or fall back to heuristic detection.
"""

import logging
import os
import re
from pathlib import Path
from typing import Optional

from ml.data_loader import load_historical_data
from ml.feature_transformer import FeatureTransformer
from ml.anomaly_model import AnomalyDetectionModel

logger = logging.getLogger(__name__)

# Model artifacts live under this fixed directory. Monitor IDs are used to build
# file names inside it, so they must be validated to prevent path traversal.
MODEL_DIR = Path("ml/models")
_MONITOR_ID_RE = re.compile(r"[A-Za-z0-9_-]+")


def resolve_model_paths(monitor_id: str) -> tuple[Path, Path]:
    """
    Validate ``monitor_id`` and return safe (model_path, transformer_path)
    located inside :data:`MODEL_DIR`.

    ``monitor_id`` originates from a user-controlled request value, so it is
    restricted to ``[A-Za-z0-9_-]`` and the resolved paths are verified to stay
    within ``MODEL_DIR`` to defend against path traversal.

    Raises:
        ValueError: if ``monitor_id`` is not a safe identifier or the resulting
            path would escape ``MODEL_DIR``.
    """
    if not isinstance(monitor_id, str) or not _MONITOR_ID_RE.fullmatch(monitor_id):
        raise ValueError(f"Invalid monitor_id: {monitor_id!r}")

    model_path = MODEL_DIR / f"{monitor_id}_anomaly_model.pkl"
    transformer_path = MODEL_DIR / f"{monitor_id}_transformer.pkl"

    base = os.path.realpath(MODEL_DIR)
    for path in (model_path, transformer_path):
        if not os.path.realpath(path).startswith(base + os.sep):
            raise ValueError(f"Invalid monitor_id path: {monitor_id!r}")

    return model_path, transformer_path


def ensure_model_exists(monitor_id: str) -> bool:
    """
    Check if a trained model exists for the monitor.
    If not, attempt to train one from historical data.
    
    Returns:
        True if model exists or was successfully trained
        False if no training data available
    """
    try:
        model_path, transformer_path = resolve_model_paths(monitor_id)
    except ValueError as e:
        logger.error(f"Refusing to build model path for monitor: {e}")
        return False
    model_dir = model_path.parent
    
    # Model already exists
    if model_path.exists() and transformer_path.exists():
        logger.debug(f"Model exists for monitor {monitor_id}")
        return True
    
    logger.info(f"Model missing for {monitor_id}, attempting to train from historical data...")
    
    # Try to train on historical data
    try:
        checks, _ = load_historical_data(monitor_id, days_back=14)
        
        if len(checks) < 20:
            logger.warning(
                f"Insufficient historical data for {monitor_id}: "
                f"got {len(checks)} checks, need at least 20"
            )
            return False
        
        logger.info(f"Found {len(checks)} checks for {monitor_id}, training model...")
        
        # Fit transformer and train model
        transformer = FeatureTransformer()
        transformer.fit(checks)
        feature_matrix = transformer.transform(checks)
        
        model = AnomalyDetectionModel(contamination=0.1)
        model.train(feature_matrix)
        
        # Save to disk
        model_dir.mkdir(parents=True, exist_ok=True)
        model.save(str(model_path))
        
        import pickle
        with open(transformer_path, "wb") as f:
            pickle.dump(transformer, f)
        
        logger.info(f"Successfully trained and saved model for {monitor_id}")
        return True
    
    except Exception as e:
        logger.error(f"Failed to train model for {monitor_id}: {e}")
        return False


def model_status(monitor_id: str) -> dict:
    """
    Return status of model for a monitor.
    
    Returns:
        {
            "monitor_id": str,
            "model_exists": bool,
            "can_infer": bool,
            "message": str
        }
    """
    try:
        model_path, transformer_path = resolve_model_paths(monitor_id)
    except ValueError as e:
        logger.error(f"Refusing to build model path for monitor: {e}")
        return {
            "monitor_id": monitor_id,
            "model_exists": False,
            "can_infer": False,
            "message": "Invalid monitor_id",
        }
    
    model_exists = model_path.exists() and transformer_path.exists()
    
    if model_exists:
        return {
            "monitor_id": monitor_id,
            "model_exists": True,
            "can_infer": True,
            "message": f"Model ready for inference",
        }
    else:
        return {
            "monitor_id": monitor_id,
            "model_exists": False,
            "can_infer": False,
            "message": f"No model found. Run: python train_anomaly_model.py {monitor_id}",
        }
