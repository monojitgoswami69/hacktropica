"""
Gemini LLM Service
Streaming and structured generation with proper async handling.
"""

from __future__ import annotations

import json
import logging
from typing import Generator, List, Dict, Optional

from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)


class LLMService:
    """Gemini LLM service with sync streaming (for StreamingResponse) and structured output."""

    def __init__(self, api_key: str, model: str, quiz_model: str):
        self.client: Optional[genai.Client] = None
        self._api_key = api_key
        self.model = model
        self.quiz_model = quiz_model

    async def initialize(self) -> None:
        try:
            self.client = genai.Client(api_key=self._api_key)
            logger.info("✅ Gemini client initialised (model: %s)", self.model)
        except Exception as exc:
            logger.error("❌ Failed to initialise Gemini: %s", exc)
            raise

    # ── Sync streaming generator ──────────────────────────────────────
    # Used with FastAPI StreamingResponse which runs sync generators in
    # a thread pool automatically — no event-loop blocking.

    def stream_chat_sync(
        self,
        messages: List[Dict[str, str]],
        system_instruction: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> Generator[str, None, None]:
        """Sync generator that yields text chunks. For use with StreamingResponse."""
        # Build Gemini contents (skip system messages — handled separately)
        contents = []
        for msg in messages:
            if msg["role"] == "system":
                continue
            role = "user" if msg["role"] == "user" else "model"
            contents.append(
                genai_types.Content(role=role, parts=[genai_types.Part(text=msg["content"])])
            )

        try:
            response = self.client.models.generate_content_stream(
                model=self.model,
                contents=contents,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                    response_modalities=["TEXT"],
                ),
            )
            for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as exc:
            logger.error("Gemini streaming error: %s", exc)
            yield f"\n\n[Error: {exc}]"

    # ── Structured JSON generation (quiz) ─────────────────────────────

    def generate_structured_sync(
        self,
        prompt: str,
        system_instruction: str,
        response_schema,
        temperature: float = 0.7,
    ) -> dict:
        """Blocking call that returns parsed JSON. Wrap in asyncio.to_thread for async."""
        response = self.client.models.generate_content(
            model=self.quiz_model,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_json_schema=response_schema,
                temperature=temperature,
                top_p=0.95,
                max_output_tokens=8192,
            ),
        )
        return json.loads(response.text)
