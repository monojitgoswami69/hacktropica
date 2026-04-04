"""Analytics and dashboard models."""

from pydantic import BaseModel
from typing import Optional, List


class SubjectAnalytics(BaseModel):
    subject: str
    total_queries: int
    proficiency_score: int
    student_count: int


class StreamAnalyticsResponse(BaseModel):
    stream: str
    semester: Optional[str] = None
    subjects: List[SubjectAnalytics]
    net_score: int
    total_students: int
    total_queries: int


class ModuleInfo(BaseModel):
    document_id: str
    title: str
    query_count: int


class StudentQueryInfo(BaseModel):
    uid: str
    name: str
    roll: str
    total_queries: int
    top_modules: List[str]


class SubjectDetailResponse(BaseModel):
    subject: str
    semester: Optional[str] = None
    stream: str
    modules: List[ModuleInfo]
    students: List[StudentQueryInfo]
    total_queries: int


class WeeklyData(BaseModel):
    date: str
    queries: int


class AtRiskStudent(BaseModel):
    uid: str
    name: str
    roll: str
    total_queries: int
    top_subjects: List[str]


class WeakDomain(BaseModel):
    subject: str
    total_queries: int
    proficiency: int
    struggling_students: List[str]


class AnalyticsOverviewResponse(BaseModel):
    stream: str
    total_queries: int
    total_students: int
    at_risk_students: List[AtRiskStudent]
    at_risk_count: int
    weak_domains: List[WeakDomain]
    weekly_data: List[WeeklyData]
