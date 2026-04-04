"""
Pydantic models — re-exported for convenience.
"""

from models.auth import LoginRequest, RegisterRequest, AuthResponse  # noqa: F401
from models.documents import (  # noqa: F401
    IngestRequest, IngestResponse, DocumentInfo, DocumentListResponse,
)
from models.search import (  # noqa: F401
    SearchFilter, SearchRequest, SearchResult, SearchResponse,
    HistoryMessage, QueryRequest, ContextChunk,
)
from models.quiz import (  # noqa: F401
    QuizOption, QuizQuestion, QuizOutputSchema,
    QuizGenerateRequest, QuizGenerateResponse, QuizSubmitRequest,
)
from models.analytics import (  # noqa: F401
    StreamAnalyticsResponse, SubjectDetailResponse,
    AnalyticsOverviewResponse, ModuleInfo, StudentQueryInfo,
    WeeklyData, AtRiskStudent, WeakDomain,
)
from models.sessions import SessionInfo  # noqa: F401
