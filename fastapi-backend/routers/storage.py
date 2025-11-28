"""
Cloud Storage routes - S3, GCS, Azure
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import json
import os
from datetime import datetime
from dotenv import load_dotenv

from database import get_db
from models import User, CloudStorageConfig, StorageFile
from schemas import CloudStorageConfigUpdate, FileResponse
from auth_utils import get_current_active_user, require_admin

# Cloud storage imports
import boto3
from google.cloud import storage as gcs_storage
from azure.storage.blob import BlobServiceClient

load_dotenv()

router = APIRouter()


@router.get("/local/browse")
async def browse_local_storage(
    path: str = "D:\\"
):
    r"""
    Browse local D:\ drive file system.
    Returns directory contents with AI-relevance metadata.
    
    Note: No authentication required for local storage access on user's own machine.
    """
    import pathlib
    from datetime import datetime as dt
    
    try:
        base_path = pathlib.Path(path)
        
        # Security: Prevent path traversal outside D:\
        if not str(base_path.resolve()).startswith("D:\\"):
            raise HTTPException(status_code=403, detail="Access restricted to D:\\ drive only")
        
        if not base_path.exists():
            raise HTTPException(status_code=404, detail=f"Path not found: {path}")
        
        if not base_path.is_dir():
            raise HTTPException(status_code=400, detail=f"Path is not a directory: {path}")
        
        files = []
        for item in base_path.iterdir():
            try:
                stat = item.stat()
                size_str = "--" if item.is_dir() else f"{stat.st_size / 1024:.1f} KB" if stat.st_size < 1024*1024 else f"{stat.st_size / (1024*1024):.1f} MB"
                modified = dt.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d")
                
                # AI relevance heuristics (basic for now)
                ai_relevance = "low"
                ext = item.suffix.lower()
                if ext in ['.py', '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.yaml', '.yml']:
                    ai_relevance = "high"
                elif ext in ['.pdf', '.doc', '.docx', '.csv', '.xml']:
                    ai_relevance = "medium"
                
                files.append({
                    "name": item.name,
                    "type": "folder" if item.is_dir() else "file",
                    "size": size_str,
                    "modified": modified,
                    "aiRelevance": ai_relevance,
                    "ext": item.suffix.lstrip('.') if not item.is_dir() else None,
                    "path": str(item)
                })
            except (PermissionError, OSError):
                # Skip files we can't access
                continue
        
        # Sort: folders first, then by name
        files.sort(key=lambda f: (f["type"] != "folder", f["name"].lower()))
        
        return {
            "path": str(base_path),
            "files": files,
            "count": len(files)
        }
    
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied: {path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error browsing directory: {str(e)}")


@router.post("/local/upload")
async def upload_to_local_storage(
    file: UploadFile = File(...),
    path: str = "D:\\"
):
    r"""
    Upload file to local D:\ drive.
    
    Note: No authentication required for local storage access on user's own machine.
    """
    import pathlib
    
    try:
        target_dir = pathlib.Path(path)
        
        # Security: Prevent path traversal outside D:\
        if not str(target_dir.resolve()).startswith("D:\\"):
            raise HTTPException(status_code=403, detail="Upload restricted to D:\\ drive only")
        
        if not target_dir.exists():
            raise HTTPException(status_code=404, detail=f"Target directory not found: {path}")
        
        if not target_dir.is_dir():
            raise HTTPException(status_code=400, detail=f"Target path is not a directory: {path}")
        
        # Build target file path
        filename = file.filename or "uploaded_file"
        target_file = target_dir / filename
        
        # Prevent overwriting existing files
        if target_file.exists():
            raise HTTPException(status_code=409, detail=f"File already exists: {file.filename}")
        
        # Write file
        content = await file.read()
        target_file.write_bytes(content)
        
        # Update user storage usage
        file_size_mb = len(content) / (1024 * 1024)
        
        return {
            "message": "File uploaded successfully",
            "filename": file.filename,
            "path": str(target_file),
            "size": f"{file_size_mb:.2f} MB"
        }
    
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied writing to: {path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}")


@router.get("/local/download")
async def download_from_local_storage(
    file_path: str
):
    r"""
    Download file from local D:\ drive.
    
    Note: No authentication required for local storage access on user's own machine.
    """
    import pathlib
    
    try:
        source_file = pathlib.Path(file_path)
        
        # Security: Prevent path traversal outside D:\
        if not str(source_file.resolve()).startswith("D:\\"):
            raise HTTPException(status_code=403, detail="Download restricted to D:\\ drive only")
        
        if not source_file.exists():
            raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
        
        if not source_file.is_file():
            raise HTTPException(status_code=400, detail=f"Path is not a file: {file_path}")
        
        # Stream file back
        content = source_file.read_bytes()
        
        return StreamingResponse(
            iter([content]),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{source_file.name}"'}
        )
    
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied reading: {file_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading file: {str(e)}")


def get_s3_client(config: CloudStorageConfig):
    """Get S3 client"""
    return boto3.client(
        's3',
        aws_access_key_id=config.access_key,
        aws_secret_access_key=config.secret_key,
        region_name=config.region
    )


def get_gcs_client(config: CloudStorageConfig):
    """Get Google Cloud Storage client"""
    # Assumes GOOGLE_APPLICATION_CREDENTIALS is set
    return gcs_storage.Client()


def get_azure_client(config: CloudStorageConfig):
    """Get Azure Blob Storage client"""
    connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    return BlobServiceClient.from_connection_string(connection_string)


@router.get("/config")
async def get_storage_config(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get cloud storage configuration"""
    config = db.query(CloudStorageConfig).first()
    
    if not config:
        return {
            "provider": "s3",
            "bucket": "",
            "region": "us-east-1",
            "accessKey": "",
            "secretKey": ""
        }
    
    return {
        "provider": config.provider,
        "bucket": config.bucket,
        "region": config.region,
        "accessKey": config.access_key,
        "secretKey": "***" if config.secret_key else ""
    }


@router.put("/config")
async def update_storage_config(
    config_data: CloudStorageConfigUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update cloud storage configuration"""
    config = db.query(CloudStorageConfig).first()
    
    if not config:
        config = CloudStorageConfig()
        db.add(config)
    
    config.provider = config_data.provider
    config.bucket = config_data.bucket
    config.region = config_data.region
    
    if config_data.accessKey:
        config.access_key = config_data.accessKey
    if config_data.secretKey:
        config.secret_key = config_data.secretKey
    
    db.commit()
    
    return {"message": "Storage configuration updated"}


@router.get("/files", response_model=List[FileResponse])
async def list_files(
    path: str = "/",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List files in cloud storage"""
    config = db.query(CloudStorageConfig).first()
    
    if not config:
        # Return mock data if not configured
        return [
            {"name": "Documents", "type": "folder", "size": "-", "modified": "2024-01-15"},
            {"name": "Images", "type": "folder", "size": "-", "modified": "2024-01-14"},
            {"name": "report.pdf", "type": "file", "size": "2.4 MB", "modified": "2024-01-20"}
        ]
    
    try:
        files = []
        
        if config.provider == "s3":
            s3 = get_s3_client(config)
            response = s3.list_objects_v2(Bucket=config.bucket, Prefix=path.lstrip('/'))
            
            if 'Contents' in response:
                for obj in response['Contents']:
                    files.append({
                        "name": obj['Key'].split('/')[-1],
                        "type": "file",
                        "size": f"{obj['Size'] / 1024:.1f} KB",
                        "modified": obj['LastModified'].strftime("%Y-%m-%d")
                    })
        
        elif config.provider == "gcs":
            client = get_gcs_client(config)
            bucket = client.bucket(config.bucket)
            blobs = bucket.list_blobs(prefix=path.lstrip('/'))
            
            for blob in blobs:
                files.append({
                    "name": blob.name.split('/')[-1],
                    "type": "file",
                    "size": f"{blob.size / 1024:.1f} KB",
                    "modified": blob.updated.strftime("%Y-%m-%d")
                })
        
        elif config.provider == "azure":
            blob_service = get_azure_client(config)
            container = blob_service.get_container_client(config.bucket)
            blobs = container.list_blobs(name_starts_with=path.lstrip('/'))
            
            for blob in blobs:
                files.append({
                    "name": blob.name.split('/')[-1],
                    "type": "file",
                    "size": f"{blob.size / 1024:.1f} KB",
                    "modified": blob.last_modified.strftime("%Y-%m-%d")
                })
        
        return files
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing files: {str(e)}"
        )


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = "/",
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload file to cloud storage"""
    config = db.query(CloudStorageConfig).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cloud storage not configured"
        )
    
    try:
        file_content = await file.read()
        file_path = f"{path.lstrip('/')}/{file.filename}"
        
        if config.provider == "s3":
            s3 = get_s3_client(config)
            s3.put_object(
                Bucket=config.bucket,
                Key=file_path,
                Body=file_content
            )
        
        elif config.provider == "gcs":
            client = get_gcs_client(config)
            bucket = client.bucket(config.bucket)
            blob = bucket.blob(file_path)
            blob.upload_from_string(file_content)
        
        elif config.provider == "azure":
            blob_service = get_azure_client(config)
            blob_client = blob_service.get_blob_client(
                container=config.bucket,
                blob=file_path
            )
            blob_client.upload_blob(file_content)
        
        # Update user storage usage
        file_size_mb = len(file_content) / (1024 * 1024)
        current_user.storage_used += file_size_mb
        db.commit()
        
        return {
            "message": "File uploaded successfully",
            "filename": file.filename,
            "size": f"{file_size_mb:.2f} MB"
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error uploading file: {str(e)}"
        )


@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Download file from cloud storage"""
    config = db.query(CloudStorageConfig).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cloud storage not configured"
        )
    
    try:
        if config.provider == "s3":
            s3 = get_s3_client(config)
            response = s3.get_object(Bucket=config.bucket, Key=file_id)
            content = response['Body'].read()
        
        elif config.provider == "gcs":
            client = get_gcs_client(config)
            bucket = client.bucket(config.bucket)
            blob = bucket.blob(file_id)
            content = blob.download_as_bytes()
        
        elif config.provider == "azure":
            blob_service = get_azure_client(config)
            blob_client = blob_service.get_blob_client(
                container=config.bucket,
                blob=file_id
            )
            content = blob_client.download_blob().readall()
        
        return StreamingResponse(
            iter([content]),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={file_id.split('/')[-1]}"}
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error downloading file: {str(e)}"
        )


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete file from cloud storage"""
    config = db.query(CloudStorageConfig).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cloud storage not configured"
        )
    
    try:
        if config.provider == "s3":
            s3 = get_s3_client(config)
            s3.delete_object(Bucket=config.bucket, Key=file_id)
        
        elif config.provider == "gcs":
            client = get_gcs_client(config)
            bucket = client.bucket(config.bucket)
            blob = bucket.blob(file_id)
            blob.delete()
        
        elif config.provider == "azure":
            blob_service = get_azure_client(config)
            blob_client = blob_service.get_blob_client(
                container=config.bucket,
                blob=file_id
            )
            blob_client.delete_blob()
        
        return {"message": "File deleted successfully"}
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting file: {str(e)}"
        )
