"""
Generic object storage client.

Reads provider credentials from environment variables so the calling code
stays provider-agnostic. Tested with Cloudflare R2, AWS S3, and Backblaze B2.

Required env vars:
  STORAGE_BUCKET        — bucket name
  STORAGE_ACCESS_KEY    — access key / key ID
  STORAGE_SECRET_KEY    — secret key

Optional:
  STORAGE_ENDPOINT_URL  — custom endpoint (omit for AWS S3)
  STORAGE_REGION        — region (default: "auto", works for R2 and B2)
"""

import os
from pathlib import Path
from typing import Union


def is_configured() -> bool:
    """Return True if the minimum storage env vars are present."""
    return bool(
        os.environ.get("STORAGE_BUCKET")
        and os.environ.get("STORAGE_ACCESS_KEY")
        and os.environ.get("STORAGE_SECRET_KEY")
    )


def _client():
    import boto3  # lazy import — only needed when storage is used

    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("STORAGE_ENDPOINT_URL"),
        aws_access_key_id=os.environ.get("STORAGE_ACCESS_KEY"),
        aws_secret_access_key=os.environ.get("STORAGE_SECRET_KEY"),
        region_name=os.environ.get("STORAGE_REGION", "auto"),
    )


def _bucket() -> str:
    bucket = os.environ.get("STORAGE_BUCKET")
    if not bucket:
        raise RuntimeError("STORAGE_BUCKET env var is not set")
    return bucket


def upload(local_path: Union[str, Path], key: str) -> None:
    """Upload a local file to the bucket under the given key."""
    _client().upload_file(str(local_path), _bucket(), key)


def download(key: str, dest_path: Union[str, Path]) -> None:
    """Download a file from the bucket to dest_path."""
    _client().download_file(_bucket(), key, str(dest_path))
