"""
Diagnostic script to check analytics collections in MongoDB.
Run this to see what's actually in the database.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def check_analytics():
    mongodb_url = os.getenv("MONGODB_URL")
    mongodb_db = os.getenv("MONGODB_DB_NAME", "vidyarthi_saarthi")
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[mongodb_db]
    
    print("=" * 60)
    print("ANALYTICS DIAGNOSTIC CHECK")
    print("=" * 60)
    
    # Check daily_queries
    print("\n1. DAILY QUERIES:")
    count = await db.daily_queries.count_documents({})
    print(f"   Total documents: {count}")
    async for doc in db.daily_queries.find().limit(5):
        print(f"   - {doc.get('date')}: {doc.get('count')} queries")
    
    # Check query_stats
    print("\n2. QUERY STATS (per student):")
    count = await db.query_stats.count_documents({})
    print(f"   Total students with stats: {count}")
    async for doc in db.query_stats.find().limit(5):
        print(f"   - Student {doc.get('_id')}: {doc.get('total_queries', 0)} queries")
        print(f"     Subjects: {list(doc.get('by_subject', {}).keys())}")
    
    # Check stream_hit_counts
    print("\n3. STREAM HIT COUNTS:")
    count = await db.stream_hit_counts.count_documents({})
    print(f"   Total streams with stats: {count}")
    async for doc in db.stream_hit_counts.find():
        print(f"   - Stream {doc.get('_id')}: {doc.get('total_queries', 0)} queries")
        print(f"     Subjects: {list(doc.get('by_subject', {}).keys())}")
    
    # Check student_profiles
    print("\n4. STUDENT PROFILES:")
    count = await db.student_profiles.count_documents({})
    print(f"   Total students: {count}")
    async for doc in db.student_profiles.find().limit(5):
        print(f"   - {doc.get('_id')}: {doc.get('name')} - Stream: {doc.get('stream')} - Sem: {doc.get('sem')}")
    
    # Check sessions
    print("\n5. RECENT SESSIONS:")
    count = await db.sessions.count_documents({})
    print(f"   Total sessions: {count}")
    async for doc in db.sessions.find().sort("updated_at", -1).limit(5):
        msg_count = len(doc.get('messages', []))
        print(f"   - Session {doc.get('_id')}: {msg_count} messages, User: {doc.get('uid')}")
    
    print("\n" + "=" * 60)
    print("DIAGNOSTIC COMPLETE")
    print("=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_analytics())
