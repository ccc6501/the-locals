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
