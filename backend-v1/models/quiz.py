"""Quiz generation and submission models."""

from pydantic import BaseModel, Field
from typing import List, Optional


class QuizOption(BaseModel):
    label: str = Field(description="Option label: A, B, C, or D")
    text: str = Field(description="The text content of this option")


class QuizQuestion(BaseModel):
    id: int = Field(description="Question number, starting from 1")
    question: str = Field(description="The question text")
    options: List[QuizOption] = Field(description="Exactly 4 options labeled A, B, C, D")
    correct_option: str = Field(description="The label of the correct option: A, B, C, or D")
    explanation: str = Field(description="Brief 1-2 sentence explanation")


class QuizOutputSchema(BaseModel):
    """Schema fed to Gemini's structured output to guarantee valid JSON."""
    questions: List[QuizQuestion] = Field(description="List of generated quiz questions")


class QuizGenerateRequest(BaseModel):
    subject: Optional[str] = None
    document_id: Optional[str] = None
    module: Optional[str] = None  # Filter by specific module/document
    num_questions: int = Field(default=10, ge=5, le=20)


class QuizGenerateResponse(BaseModel):
    quiz_id: str
    subject: str
    num_questions: int
    questions: List[QuizQuestion]
    generated_at: str
    context_chunks_used: int


class QuizSubmitRequest(BaseModel):
    quiz_id: str
    subject: str
    score: int
    total_questions: int
