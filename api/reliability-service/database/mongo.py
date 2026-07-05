import os

from pymongo import MongoClient

_client: MongoClient | None = None


def get_database():
    mongo_uri = os.getenv("MONGO_URI")
    if not mongo_uri:
        return None

    mongo_db = os.getenv("MONGO_DB", "Upstat")

    global _client
    if _client is None:
        _client = MongoClient(mongo_uri)

    return _client[mongo_db]
