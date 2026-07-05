from typing import List, Tuple
import os
import logging
from datetime import datetime, timedelta
from pymongo import MongoClient

logger = logging.getLogger(__name__)

def load_historical_data(monitor_id: str, days_back: int = 7) -> Tuple[List[dict], List]:
    """
    Load historical check data from MongoDB and extract raw check records.
    
    MongoDB CheckResult schema (from Go backend):
    - monitorId: string
    - responseTimeMs: int64
    - status: string ("up" or "down")
    - statusCode: int
    - attempts: int
    - checkedAt: datetime
    - error: string (optional)
    - createdAt: datetime
    
    Returns: (list of check dicts matching Go schema, empty list for compatibility)
    """
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    mongo_db = os.getenv("MONGO_DB", "Upstat")
    
    try:
        client = MongoClient(mongo_uri)
        db = client[mongo_db]
        checks_collection = db["CheckResult"]
        
        # Query checks from the last N days, sorted by checkedAt ascending
        since = datetime.utcnow() - timedelta(days=days_back)
        query = {
            "monitorId": monitor_id,
            "checkedAt": {"$gte": since}
        }
        
        # Fetch with sorting by checkedAt (oldest first)
        checks = list(checks_collection.find(query).sort("checkedAt", 1))
        logger.info(f"Loaded {len(checks)} checks for {monitor_id} from last {days_back} days")
        
        return checks, []
    
    except Exception as e:
        logger.error(f"Failed to load historical data: {e}")
        return [], []
