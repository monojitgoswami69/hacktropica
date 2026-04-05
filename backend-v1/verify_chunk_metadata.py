"""
Verify that all chunks in the vector store have proper metadata.
This is CRITICAL for analytics to work.
"""
import asyncio
import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
from services.vector_store import VectorStore
from config import Settings

load_dotenv()

async def verify_metadata():
    settings = Settings()
    
    # Initialize vector store
    vs = VectorStore(
        mode=settings.qdrant_mode,
        path=settings.qdrant_path,
        host=settings.qdrant_host,
        port=settings.qdrant_port,
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        collection=settings.qdrant_collection,
        dim=settings.embedding_dim,
    )
    
    await vs.connect()
    
    print("=" * 70)
    print("CHUNK METADATA VERIFICATION")
    print("=" * 70)
    
    total_chunks = len(vs.chunks)
    print(f"\nTotal chunks in vector store: {total_chunks}")
    
    if total_chunks == 0:
        print("\n❌ NO CHUNKS FOUND! You need to upload documents first.")
        return
    
    # Check metadata completeness
    missing_subject = []
    missing_stream = []
    missing_module = []
    missing_title = []
    
    for chunk_id, chunk in vs.chunks.items():
        if not chunk.subject:
            missing_subject.append((chunk_id, chunk.document_id, chunk.source))
        if not chunk.stream:
            missing_stream.append((chunk_id, chunk.document_id, chunk.source))
        if not chunk.module:
            missing_module.append((chunk_id, chunk.document_id, chunk.source))
        if not chunk.title:
            missing_title.append((chunk_id, chunk.document_id, chunk.source))
    
    print("\n" + "=" * 70)
    print("METADATA COMPLETENESS REPORT")
    print("=" * 70)
    
    print(f"\n✅ Chunks with subject: {total_chunks - len(missing_subject)}/{total_chunks}")
    if missing_subject:
        print(f"❌ Chunks WITHOUT subject: {len(missing_subject)}")
        print("   This is CRITICAL! Analytics will not work without subject metadata.")
        print("   First 5 chunks missing subject:")
        for chunk_id, doc_id, source in missing_subject[:5]:
            print(f"   - {chunk_id[:8]}... (doc: {doc_id}, source: {source})")
    
    print(f"\n✅ Chunks with stream: {total_chunks - len(missing_stream)}/{total_chunks}")
    if missing_stream:
        print(f"⚠️  Chunks WITHOUT stream: {len(missing_stream)}")
        print("   Stream analytics will fall back to student profile.")
        print("   First 5 chunks missing stream:")
        for chunk_id, doc_id, source in missing_stream[:5]:
            print(f"   - {chunk_id[:8]}... (doc: {doc_id}, source: {source})")
    
    print(f"\n✅ Chunks with module: {total_chunks - len(missing_module)}/{total_chunks}")
    if missing_module:
        print(f"⚠️  Chunks WITHOUT module: {len(missing_module)}")
        print("   Module analytics may be incomplete.")
    
    print(f"\n✅ Chunks with title: {total_chunks - len(missing_title)}/{total_chunks}")
    if missing_title:
        print(f"⚠️  Chunks WITHOUT title: {len(missing_title)}")
        print("   Titles will fall back to source filename.")
    
    # Show sample of complete chunks
    print("\n" + "=" * 70)
    print("SAMPLE CHUNKS (first 3 with complete metadata)")
    print("=" * 70)
    
    complete_chunks = [
        (cid, c) for cid, c in vs.chunks.items()
        if c.subject and c.stream and c.module and c.title
    ]
    
    for chunk_id, chunk in complete_chunks[:3]:
        print(f"\n📦 Chunk: {chunk_id[:12]}...")
        print(f"   Document ID: {chunk.document_id}")
        print(f"   Title: {chunk.title}")
        print(f"   Subject: {chunk.subject}")
        print(f"   Stream: {chunk.stream}")
        print(f"   Module: {chunk.module}")
        print(f"   Semester: {chunk.semester}")
        print(f"   Source: {chunk.source}")
        print(f"   Text preview: {chunk.text[:100]}...")
    
    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    
    if missing_subject:
        print("\n❌ CRITICAL ISSUE: Some chunks are missing subject metadata!")
        print("   Analytics WILL NOT WORK for these chunks.")
        print("   You need to re-upload these documents with proper metadata.")
        print("\n   Documents affected:")
        affected_docs = set(doc_id for _, doc_id, _ in missing_subject)
        for doc_id in list(affected_docs)[:10]:
            print(f"   - {doc_id}")
        if len(affected_docs) > 10:
            print(f"   ... and {len(affected_docs) - 10} more")
    else:
        print("\n✅ All chunks have subject metadata - GOOD!")
    
    if missing_stream:
        print("\n⚠️  Some chunks are missing stream metadata.")
        print("   Analytics will use student profile stream as fallback.")
        print("   Consider re-uploading with stream metadata for better accuracy.")
    else:
        print("✅ All chunks have stream metadata - EXCELLENT!")
    
    print("\n" + "=" * 70)

if __name__ == "__main__":
    asyncio.run(verify_metadata())
