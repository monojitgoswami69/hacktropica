"""
Script to ensure all students have a stream value in their profile.
This is required for stream-level analytics to work.
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

async def fix_student_streams():
    mongodb_url = os.getenv("MONGODB_URL")
    mongodb_db = os.getenv("MONGODB_DB_NAME", "vidyarthi_saarthi")
    
    client = AsyncIOMotorClient(mongodb_url)
    db = client[mongodb_db]
    
    print("=" * 60)
    print("FIXING STUDENT STREAMS")
    print("=" * 60)
    
    # Find students without stream
    students_without_stream = []
    async for doc in db.student_profiles.find({"$or": [{"stream": {"$exists": False}}, {"stream": ""}]}):
        students_without_stream.append(doc)
    
    if not students_without_stream:
        print("\n✅ All students already have stream values!")
        client.close()
        return
    
    print(f"\n⚠️  Found {len(students_without_stream)} students without stream:")
    for student in students_without_stream:
        print(f"   - {student.get('_id')}: {student.get('name', 'Unknown')} ({student.get('email', 'No email')})")
    
    print("\nOptions:")
    print("1. Set all to 'cse' (Computer Science)")
    print("2. Set all to 'ece' (Electronics)")
    print("3. Set all to 'me' (Mechanical)")
    print("4. Skip (fix manually)")
    
    choice = input("\nEnter choice (1-4): ").strip()
    
    stream_map = {
        "1": "cse",
        "2": "ece",
        "3": "me"
    }
    
    if choice not in stream_map:
        print("Skipping automatic fix. Please update manually.")
        client.close()
        return
    
    stream = stream_map[choice]
    
    # Update all students
    result = await db.student_profiles.update_many(
        {"$or": [{"stream": {"$exists": False}}, {"stream": ""}]},
        {"$set": {"stream": stream}}
    )
    
    print(f"\n✅ Updated {result.modified_count} students to stream '{stream}'")
    
    # Verify
    print("\nVerifying...")
    count_with_stream = await db.student_profiles.count_documents({"stream": {"$exists": True, "$ne": ""}})
    total_count = await db.student_profiles.count_documents({})
    
    print(f"   Students with stream: {count_with_stream}/{total_count}")
    
    if count_with_stream == total_count:
        print("\n✅ All students now have stream values!")
    else:
        print(f"\n⚠️  {total_count - count_with_stream} students still missing stream")
    
    print("\n" + "=" * 60)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_student_streams())
