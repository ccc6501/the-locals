"""Script to add local storage endpoints to storage.py"""

# Read current file
with open('routers/storage.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line with "router = APIRouter()"
router_line_idx = None
for i, line in enumerate(lines):
    if 'router = APIRouter()' in line:
        router_line_idx = i
        break

if router_line_idx is None:
    print("Could not find router definition!")
    exit(1)

# Local endpoints to insert
local_endpoints = '''

@router.get("/local/browse")
async def browse_local_storage(
    path: str = "D:\\\\"
):
    r"""
    Browse local D:\\ drive file system.
    Returns directory contents with AI-relevance metadata.
    
    Note: No authentication required for local storage access on user's own machine.
    """
    import pathlib
    from datetime import datetime as dt
    
    try:
        base_path = pathlib.Path(path)
        
        # Security: Prevent path traversal outside D:\\
        if not str(base_path.resolve()).startswith("D:\\\\"):
            raise HTTPException(status_code=403, detail="Access restricted to D:\\\\ drive only")
        
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
    path: str = "D:\\\\"
):
    r"""
    Upload file to local D:\\ drive.
    
    Note: No authentication required for local storage access on user's own machine.
    """
    import pathlib
    
    try:
        target_dir = pathlib.Path(path)
        
        # Security: Prevent path traversal outside D:\\
        if not str(target_dir.resolve()).startswith("D:\\\\"):
            raise HTTPException(status_code=403, detail="Upload restricted to D:\\\\ drive only")
        
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
    Download file from local D:\\ drive.
    
    Note: No authentication required for local storage access on user's own machine.
    """
    import pathlib
    
    try:
        source_file = pathlib.Path(file_path)
        
        # Security: Prevent path traversal outside D:\\
        if not str(source_file.resolve()).startswith("D:\\\\"):
            raise HTTPException(status_code=403, detail="Download restricted to D:\\\\ drive only")
        
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

'''

# Insert after router definition line
# Find the next blank line after router = APIRouter()
insert_idx = router_line_idx + 1
while insert_idx < len(lines) and lines[insert_idx].strip() == '':
    insert_idx += 1

# Insert the local endpoints
new_lines = lines[:insert_idx] + [local_endpoints] + lines[insert_idx:]

# Write back
with open('routers/storage.py', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print(f"✓ Added local storage endpoints after line {insert_idx}")
print(f"✓ New file has {len(new_lines)} lines")
