"""
Cloudflare R2 Storage Service
S3-compatible object storage with public URL generation and presigned downloads.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


class StorageService:
    """Cloudflare R2 file storage with public preview URLs and presigned downloads."""

    def __init__(
        self,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        bucket_name: str,
        public_url: Optional[str] = None,
    ):
        self._account_id = account_id
        self._access_key_id = access_key_id
        self._secret_access_key = secret_access_key
        self._bucket_name = bucket_name
        self._public_url = public_url.rstrip("/") if public_url else None
        self._client = None
        self._endpoint = f"https://{account_id}.r2.cloudflarestorage.com"

    async def initialize(self) -> None:
        """Create the S3-compatible client for R2."""
        self._client = await asyncio.to_thread(
            boto3.client,
            "s3",
            endpoint_url=self._endpoint,
            aws_access_key_id=self._access_key_id,
            aws_secret_access_key=self._secret_access_key,
            config=BotoConfig(
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
            ),
            region_name="auto",
        )
        # Verify bucket access
        try:
            await asyncio.to_thread(self._client.head_bucket, Bucket=self._bucket_name)
            logger.info("✅ R2 storage connected (bucket: %s)", self._bucket_name)
        except ClientError:
            logger.warning("⚠️  R2 bucket '%s' not accessible — uploads may fail", self._bucket_name)

    # ── Upload / Download / Delete ────────────────────────────────────

    async def upload(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        filename: Optional[str] = None,
    ) -> str:
        """Upload bytes to R2. Returns the storage key."""
        extra_args = {"ContentType": content_type}
        if filename:
            extra_args["ContentDisposition"] = f'inline; filename="{filename}"'

        await asyncio.to_thread(
            self._client.put_object,
            Bucket=self._bucket_name,
            Key=key,
            Body=data,
            **extra_args,
        )
        logger.info("Uploaded %s (%d bytes, %s)", key, len(data), content_type)
        return key

    async def download(self, key: str) -> bytes:
        """Download file bytes from R2."""
        response = await asyncio.to_thread(
            self._client.get_object,
            Bucket=self._bucket_name,
            Key=key,
        )
        body = response["Body"]
        data = await asyncio.to_thread(body.read)
        return data

    async def delete(self, key: str) -> None:
        """Delete a file from R2."""
        try:
            await asyncio.to_thread(
                self._client.delete_object,
                Bucket=self._bucket_name,
                Key=key,
            )
        except ClientError as exc:
            logger.warning("R2 delete failed for %s: %s", key, exc)

    # ── URL Generation ────────────────────────────────────────────────

    def get_public_url(self, key: str) -> Optional[str]:
        """
        Permanent public URL.
        Requires public access enabled on the R2 bucket (via r2.dev subdomain
        or custom domain). Set R2_PUBLIC_URL in env to enable.
        """
        if self._public_url:
            return f"{self._public_url}/{key}"
        return None

    async def get_presigned_url(
        self,
        key: str,
        expires_in: int = 3600,
        response_content_type: Optional[str] = None,
    ) -> str:
        """Generate a temporary presigned URL (default 1 hour)."""
        params = {"Bucket": self._bucket_name, "Key": key}
        if response_content_type:
            params["ResponseContentType"] = response_content_type

        url = await asyncio.to_thread(
            self._client.generate_presigned_url,
            "get_object",
            Params=params,
            ExpiresIn=expires_in,
        )
        return url

    def get_preview_url(self, key: str) -> Optional[str]:
        """
        Return the best publicly-accessible URL for previewing a file.
        Prefers permanent public URL, returns None if unavailable
        (caller should fall back to presigned).
        """
        return self.get_public_url(key)

    @property
    def is_configured(self) -> bool:
        return self._client is not None
