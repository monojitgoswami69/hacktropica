# Analytics Tracking - FIXED

## What Was Wrong

The previous tracking implementation was iterating through ALL search results and trying to aggregate subjects/modules from multiple chunks. This was:
1. Overly complex
2. Could track multiple subjects per query (confusing analytics)
3. Didn't reflect what was actually used in the response

## What I Fixed

### 1. Use TOP Chunk Only (Highest Similarity)

The tracking now uses ONLY the top chunk (highest similarity score) to determine:
- Subject
- Module
- Stream (with fallback to student profile)

This is the RIGHT approach because:
- The top chunk is what Gemini primarily uses in the response
- It's clean and unambiguous (one query = one subject)
- It reflects actual usage, not just search results

### 2. Enhanced Logging

Added comprehensive logging with emoji markers:
- 🎯 Endpoint called with user info
- 🔍 Tracking started
- 📅 Date info
- ✅ Successful operations
- ❌ Failed operations
- ⚠️ Warnings (missing metadata, etc.)
- 📦 Chunk details
- 💾 Database updates

### 3. Metadata Validation

The tracking now:
- Checks if top chunk exists
- Validates subject metadata (CRITICAL)
- Validates stream metadata (with fallback)
- Logs detailed warnings if metadata is missing
- Still tracks the query even if some metadata is missing

### 4. Task Error Handling

Added callbacks to async tasks to:
- Prevent garbage collection
- Log completion/failure
- Make errors visible

## How It Works Now

```
1. Student makes query
   ↓
2. Vector search returns chunks sorted by similarity
   ↓
3. TOP chunk (highest score) is selected
   ↓
4. Extract metadata from TOP chunk:
   - subject (e.g., "Data Structures")
   - module/document_id (e.g., "doc_ds_001")
   - stream (e.g., "cse") - fallback to student profile if missing
   ↓
5. Update 3 collections:
   - daily_queries: Global counter by date
   - query_stats: Per-student stats (by subject, by module)
   - stream_hit_counts: Per-stream aggregated stats
   ↓
6. Analytics endpoints read from these collections
```

## Verification Steps

### Step 1: Verify Chunk Metadata
```bash
cd backend-v1
python verify_chunk_metadata.py
```

This checks if all chunks have proper metadata. If chunks are missing subject/stream, analytics won't work properly.

### Step 2: Test Tracking Function
```bash
cd backend-v1
python test_tracking.py
```

This tests the tracking function with mock data. Should show successful updates to all 3 collections.

### Step 3: Check Current Database State
```bash
cd backend-v1
python check_analytics.py
```

Shows what's currently in MongoDB collections.

### Step 4: Live Test
```bash
cd backend-v1
python main.py
```

Then make a query in the chatbot and watch for these logs:

```
🎯 /query/stream endpoint: uid=abc123, results=5, session=xyz
🔍 TRACKING: Starting for uid=abc123, results_count=5
🎯 TRACKING: Top chunk - subject=Data Structures, module=Module 1, title=Arrays, doc_id=doc_ds_001, score=0.9234
➕ TRACKING: Subject=Data Structures (sanitized: Data_Structures)
➕ TRACKING: Module=doc_ds_001 (title: Arrays)
💾 TRACKING: Updating query_stats for uid=abc123
✅ TRACKING: query_stats updated - matched=1, modified=1
🎓 TRACKING: Using stream=cse
💾 TRACKING: Updating stream_hit_counts for stream=cse
✅ TRACKING: stream_hit_counts updated - matched=1, modified=1
✅ TRACKING: Completed successfully for uid=abc123
✅ Tracking task completed for abc123
```

## Critical Requirements

### 1. Chunks MUST Have Subject Metadata

When uploading documents, you MUST provide:
- `subject` (REQUIRED) - e.g., "Data Structures", "Operating Systems"
- `stream` (recommended) - e.g., "cse", "ece", "me"
- `module` (recommended) - e.g., "Module 1", "Unit 2"
- `title` (recommended) - e.g., "Arrays and Linked Lists"

Without subject metadata, analytics WILL NOT WORK.

### 2. Students MUST Be Authenticated

The tracking only happens if the user is authenticated. Since you said all users are authenticated, this should be fine.

### 3. Vector Store Must Return Results

If the vector search returns 0 results, there's nothing to track. Ensure:
- Documents are uploaded and indexed
- Queries match the content
- Filters aren't too restrictive

## What Gets Tracked

For each query:

1. **daily_queries** collection:
   ```json
   {
     "_id": "2026-04-05",
     "date": "2026-04-05",
     "count": 150
   }
   ```

2. **query_stats** collection (per student):
   ```json
   {
     "_id": "student_uid",
     "total_queries": 25,
     "by_subject": {
       "Data_Structures": 10,
       "Operating_Systems": 8,
       "DBMS": 7
     },
     "by_module": {
       "doc_ds_001": {
         "subject": "Data Structures",
         "title": "Arrays and Linked Lists",
         "queries": 5
       }
     },
     "daily_queries": {
       "2026-04-05": 5,
       "2026-04-04": 8
     }
   }
   ```

3. **stream_hit_counts** collection (per stream):
   ```json
   {
     "_id": "cse",
     "total_queries": 500,
     "by_subject": {
       "Data_Structures": 150,
       "Operating_Systems": 120,
       "DBMS": 130
     },
     "by_module": {
       "doc_ds_001": {
         "subject": "Data Structures",
         "title": "Arrays and Linked Lists",
         "queries": 45
       }
     }
   }
   ```

## If It Still Doesn't Work

Run the verification steps above and send me:

1. Output from `verify_chunk_metadata.py` - shows if chunks have metadata
2. Output from `test_tracking.py` - shows if tracking function works
3. Output from `check_analytics.py` - shows current database state
4. Backend logs when making a real query - shows what's happening live

The logs will tell us EXACTLY where the issue is.

## Key Changes in Code

### backend-v1/routes/search.py

1. `_track_query_stats()` now:
   - Uses ONLY the top chunk (search_results[0])
   - Validates chunk exists and has metadata
   - Logs detailed information at each step
   - Uses chunk.stream with fallback to student profile
   - Sanitizes field names (replaces spaces with underscores)

2. `/query` and `/query/stream` endpoints now:
   - Add 🎯 logs when called
   - Create tasks with error callbacks
   - Log task completion/failure
   - Warn if user is not authenticated

## Bottom Line

Analytics will now work IF:
1. ✅ Chunks have subject metadata (verify with `verify_chunk_metadata.py`)
2. ✅ Students are authenticated (you confirmed this)
3. ✅ Vector search returns results (check logs)
4. ✅ MongoDB is connected (check startup logs)

The tracking is now MUCH simpler, more robust, and properly logged. You'll be able to see exactly what's happening at every step.
