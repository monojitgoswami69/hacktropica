"""
Gemini LLM Service
Async chat streaming via client.aio.chats, structured generation for quizzes.
"""

from __future__ import annotations

import json
import logging
from typing import AsyncGenerator, List, Dict, Optional

from google import genai
from google.genai import types as genai_types

logger = logging.getLogger(__name__)


class LLMService:
    """Gemini LLM service using the async chats API for streaming."""

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

    # ── Async streaming chat ──────────────────────────────────────────

    async def stream_chat_async(
        self,
        user_message: str,
        *,
        system_instruction: str,
        history: Optional[List[genai_types.Content]] = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> AsyncGenerator[str, None]:
        """
        Create an async chat session with system_instruction and history,
        then stream the response to the user's latest message.
        """
        chat = self.client.aio.chats.create(
            model=self.model,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=temperature,
                max_output_tokens=max_tokens,
                response_modalities=["TEXT"],
            ),
            history=history or [],
        )

        try:
            response = await chat.send_message_stream(user_message)
            async for chunk in response:
                if chunk.text:
                    yield chunk.text
        except Exception as exc:
            logger.error("Gemini streaming error: %s", exc)
            yield f"\n\n[Error: {exc}]"

    # ── Structured chat (JSON schema enforced) ──────────────────────────

    async def generate_chat_structured_async(
        self,
        user_message: str,
        *,
        system_instruction: str,
        history: Optional[List[genai_types.Content]] = None,
        response_schema,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> dict:
        """
        Async chat with enforced JSON schema output.
        Uses client.aio.chats for history/system_instruction support.
        Returns parsed dict matching the schema.
        """
        chat = self.client.aio.chats.create(
            model=self.model,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_json_schema=response_schema,
                temperature=temperature,
                max_output_tokens=max_tokens,
            ),
            history=history or [],
        )

        response = await chat.send_message(user_message)
        return json.loads(response.text)

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
