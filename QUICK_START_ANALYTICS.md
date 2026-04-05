# Analytics Fix - Quick Start

## TL;DR

I completely rewrote the analytics tracking to use ONLY the top chunk (highest similarity) for determining subject/stream/module. This is the correct approach since it reflects what's actually used in the response.

## Run These 3 Commands

```bash
cd backend-v1

# 1. Check if chunks have metadata (CRITICAL)
python verify_chunk_metadata.py

# 2. Test if tracking works
python test_tracking.py

# 3. Start backend and make a test query
python main.py
```

## What to Look For

### 1. Chunk Metadata Verification

**Good output:**
```
✅ Chunks with subject: 150/150
✅ All chunks have subject metadata - GOOD!
```

**Bad output:**
```
❌ Chunks WITHOUT subject: 50
This is CRITICAL! Analytics will not work without subject metadata.
```

**Fix:** Re-upload documents with proper subject metadata.

### 2. Test Tracking

**Good output:**
```
✅ query_stats updated:
   Total queries: 1
   Subjects: {'Data_Structures': 1}
   
✅ stream_hit_counts updated:
   Total queries: 1
   Subjects: {'Data_Structures': 1}
   
✅ daily_queries updated:
   Count: 1
```

**Bad output:**
```
❌ No query_stats found
❌ No stream_hit_counts found
```

**Fix:** Check MongoDB connection and logs for errors.

### 3. Live Backend Logs

**Good logs (what you want to see):**
```
🎯 /query/stream endpoint: uid=abc123, results=5
🔍 TRACKING: Starting for uid=abc123, results_count=5
🎯 TRACKING: Top chunk - subject=Data Structures, score=0.92
✅ TRACKING: Completed successfully
✅ Tracking task completed
```

**Bad logs (problems):**
```
⚠️ /query/stream called without authenticated user
   → Students not logged in

🔍 TRACKING: Starting for uid=abc123, results_count=0
   → No search results (vector store issue)

❌ TRACKING: Top chunk has NO SUBJECT!
   → Chunks missing metadata

❌ TRACKING: Failed for uid=abc123: <error>
   → Check the error message
```

## Most Likely Issues

### Issue 1: Chunks Missing Subject Metadata

**Symptom:** `verify_chunk_metadata.py` shows chunks without subject

**Fix:** When uploading documents, ensure you provide:
```json
{
  "subject": "Data Structures",  // REQUIRED
  "stream": "cse",               // Recommended
  "module": "Module 1",          // Recommended
  "title": "Arrays"              // Recommended
}
```

### Issue 2: No Search Results

**Symptom:** Logs show "results_count=0"

**Fix:**
- Upload documents to the vector store
- Try a simple query like "what is an array?"
- Check if filters are too restrictive

### Issue 3: MongoDB Not Connected

**Symptom:** Errors about MongoDB connection

**Fix:**
- Check `.env` file has correct `MONGODB_URL`
- Verify MongoDB Atlas IP whitelist
- Check cluster is not paused

## After Fix

1. Restart backend
2. Have a student make a query
3. Check analytics page - should show data now
4. Run `python check_analytics.py` to verify collections are populated

## Need Help?

Send me the output from all 3 commands above + backend logs when making a query.
