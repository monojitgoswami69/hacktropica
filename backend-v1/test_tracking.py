"""
Test script to manually trigger the tracking function.
This will help identify if the issue is with the tracking logic itself.
"""
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)

logger = logging.getLogger(__name__)

# Mock chunk class
class MockChunk:
    def __init__(self, subject, document_id, title, stream="cse", module="Module 1"):
        self.subject = subject
        self.document_id = document_id
        self.title = title
        self.source = title
        self.stream = stream
        self.module = module

# Mock vector store
class MockVectorStore:
    def __init__(self):
        self.chunks_data = {
            "chunk1": MockChunk("Data Structures", "doc_ds_001", "Arrays and Linked Lists", "cse", "Module 1"),
            "chunk2": MockChunk("Data Structures", "doc_ds_002", "Trees and Graphs", "cse", "Module 2"),
            "chunk3": MockChunk("Operating Systems", "doc_os_001", "Process Management", "cse", "Module 3"),
        }
    
    def get_chunk(self, chunk_id):
        return self.chunks_data.get(chunk_id)

# Mock database
class MockDB:
    def __init__(self, db):
        self.db = db

async def test_tracking():
    mongodb_url = os.getenv("MONGODB_URL")
    mongodb_db = os.getenv("MONGODB_DB_NAME", "vidyarthi_saarthi")
    
    client = AsyncIOMotorClient(mongodb_url)
    db_obj = MockDB(client[mongodb_db])
    vs = MockVectorStore()
    
    # Test data
    test_uid = "test_student_001"
    test_stream = "cse"
    
    # Create a test student profile if it doesn't exist
    await db_obj.db.student_profiles.update_one(
        {"_id": test_uid},
        {
            "$set": {
                "name": "Test Student",
                "email": "test@example.com",
                "stream": test_stream,
                "sem": "3"
            }
        },
        upsert=True
    )
    
    # Mock search results - sorted by similarity (highest first)
    search_results = [
        ("chunk1", 0.95),  # TOP chunk - this will be used for tracking
        ("chunk2", 0.87),
        ("chunk3", 0.82),
    ]
    
    print("=" * 60)
    print("TESTING TRACKING FUNCTION")
    print("=" * 60)
    print(f"Test UID: {test_uid}")
    print(f"Test Stream: {test_stream}")
    print(f"Mock search results: {len(search_results)} chunks")
    print(f"TOP chunk (will be used): chunk1 - Data Structures (score: 0.95)")
    print()
    
    # Import and run the tracking function
    from routes.search import _track_query_stats
    
    print("Calling _track_query_stats...")
    await _track_query_stats(db_obj, test_uid, search_results, vs)
    
    print("\nWaiting for async operations to complete...")
    await asyncio.sleep(2)
    
    # Check results
    print("\n" + "=" * 60)
    print("RESULTS:")
    print("=" * 60)
    
    # Check query_stats
    stats = await db_obj.db.query_stats.find_one({"_id": test_uid})
    if stats:
        print(f"\n✅ query_stats updated:")
        print(f"   Total queries: {stats.get('total_queries', 0)}")
        print(f"   Subjects: {stats.get('by_subject', {})}")
        print(f"   Modules: {list(stats.get('by_module', {}).keys())}")
        if stats.get('by_module'):
            for mod_id, mod_data in stats.get('by_module', {}).items():
                if isinstance(mod_data, dict):
                    print(f"      - {mod_id}: {mod_data.get('queries', 0)} queries, subject: {mod_data.get('subject')}")
    else:
        print(f"\n❌ No query_stats found for {test_uid}")
    
    # Check stream_hit_counts
    stream_stats = await db_obj.db.stream_hit_counts.find_one({"_id": test_stream})
    if stream_stats:
        print(f"\n✅ stream_hit_counts updated:")
        print(f"   Total queries: {stream_stats.get('total_queries', 0)}")
        print(f"   Subjects: {stream_stats.get('by_subject', {})}")
        print(f"   Modules: {list(stream_stats.get('by_module', {}).keys())}")
        if stream_stats.get('by_module'):
            for mod_id, mod_data in stream_stats.get('by_module', {}).items():
                if isinstance(mod_data, dict):
                    print(f"      - {mod_id}: {mod_data.get('queries', 0)} queries, subject: {mod_data.get('subject')}")
    else:
        print(f"\n❌ No stream_hit_counts found for {test_stream}")
    
    # Check daily_queries
    from datetime import datetime
    import pytz
    ist = pytz.timezone("Asia/Kolkata")
    today = datetime.now(ist).strftime("%Y-%m-%d")
    daily = await db_obj.db.daily_queries.find_one({"date": today})
    if daily:
        print(f"\n✅ daily_queries updated:")
        print(f"   Date: {daily.get('date')}")
        print(f"   Count: {daily.get('count', 0)}")
    else:
        print(f"\n❌ No daily_queries found for {today}")
    
    print("\n" + "=" * 60)
    print("EXPECTED BEHAVIOR:")
    print("=" * 60)
    print("Since we use the TOP chunk (chunk1 - Data Structures):")
    print("  - Subject should be: Data_Structures")
    print("  - Module should be: doc_ds_001")
    print("  - Stream should be: cse")
    print("\nIf you see different results, there's a bug in the tracking logic.")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(test_tracking())
