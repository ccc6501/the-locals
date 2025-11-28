import React, { useState, useEffect } from 'react';
import { FolderOpen, File, HardDrive, RefreshCw, Search, ChevronRight, FileText, Image as ImageIcon, Video, Music, Archive, Code, Upload, Download } from 'lucide-react';

export function CloudPanel({ apiBase }) {
    const [currentPath, setCurrentPath] = useState('D:\\');
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [aiContext, setAiContext] = useState(null);
    const [storageStats, setStorageStats] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        loadDirectory(currentPath);
        loadStorageStats();
    }, [currentPath]);

    const loadDirectory = async (path) => {
        setLoading(true);
        try {
            // Get auth token
            const tokenCandidates = ['chatops_token', 'auth_token', 'jwt', 'access_token'];
            let bearer = null;
            for (const k of tokenCandidates) {
                const v = localStorage.getItem(k);
                if (v) {
                    bearer = v;
                    break;
                }
            }

            const headers = {};
            if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

            const response = await fetch(`${apiBase}/api/storage/local/browse?path=${encodeURIComponent(path)}`, { headers });
            if (response.ok) {
                const data = await response.json();
                setFiles(data.files || []);
            } else {
                console.error('Failed to load directory:', response.status, response.statusText);
                // Fallback to empty
                setFiles([]);
            }
        } catch (e) {
            console.error('Error loading directory:', e);
            setFiles([]);
        } finally {
            setLoading(false);
        }
    };

    const loadStorageStats = async () => {
        try {
            // Mock storage stats - backend would provide real disk usage
            setStorageStats({
                total: '500 GB',
                used: '234 GB',
                free: '266 GB',
                usedPercent: 47
            });
        } catch (e) {
            console.error('Error loading storage stats:', e);
        }
    };

    const navigateToFolder = (folderName) => {
        const newPath = currentPath.endsWith('\\') ? `${currentPath}${folderName}` : `${currentPath}\\${folderName}`;
        setCurrentPath(newPath);
    };

    const navigateUp = () => {
        const parts = currentPath.split('\\').filter(Boolean);
        if (parts.length > 1) {
            parts.pop();
            setCurrentPath(parts.join('\\') + '\\');
        }
    };

    const getFileIcon = (file) => {
        if (file.type === 'folder') return <FolderOpen className="w-4 h-4 text-sky-400" />;
        const ext = file.ext || file.name.split('.').pop()?.toLowerCase();
        if (['jpg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return <ImageIcon className="w-4 h-4 text-purple-400" />;
        if (['mp4', 'avi', 'mkv', 'mov'].includes(ext)) return <Video className="w-4 h-4 text-pink-400" />;
        if (['mp3', 'wav', 'flac', 'ogg'].includes(ext)) return <Music className="w-4 h-4 text-emerald-400" />;
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <Archive className="w-4 h-4 text-amber-400" />;
        if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(ext)) return <Code className="w-4 h-4 text-cyan-400" />;
        if (['md', 'txt', 'doc', 'docx', 'pdf'].includes(ext)) return <FileText className="w-4 h-4 text-slate-400" />;
        return <File className="w-4 h-4 text-slate-500" />;
    };

    const getAiRelevanceBadge = (relevance) => {
        if (relevance === 'high') return <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-600/20 text-violet-400 border border-violet-600/30">AI+</span>;
        if (relevance === 'medium') return <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-600/20 text-sky-400 border border-sky-600/30">AI</span>;
        return null;
    };

    const filteredFiles = searchQuery.trim()
        ? files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : files;

    const handleFileClick = (file) => {
        if (file.type === 'folder') {
            navigateToFolder(file.name);
        } else {
            setSelectedFile(file);
            // Mock AI context - in production, backend would analyze file content
            setAiContext({
                summary: `${file.name} (${file.size}). Last modified ${file.modified}. AI relevance: ${file.aiRelevance}.`,
                tags: [file.type, file.aiRelevance, file.ext || 'unknown'].filter(Boolean),
                relatedFiles: files.filter(f => f.type === 'file' && f.name !== file.name && f.aiRelevance === file.aiRelevance).slice(0, 2).map(f => f.name)
            });
        }
    };

    const handleDownload = async (file) => {
        try {
            // Get auth token
            const tokenCandidates = ['chatops_token', 'auth_token', 'jwt', 'access_token'];
            let bearer = null;
            for (const k of tokenCandidates) {
                const v = localStorage.getItem(k);
                if (v) {
                    bearer = v;
                    break;
                }
            }

            const headers = {};
            if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

            const response = await fetch(`${apiBase}/api/storage/local/download?file_path=${encodeURIComponent(file.path)}`, { headers });
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            } else {
                console.error('Download failed:', response.statusText);
                alert('Download failed: ' + response.statusText);
            }
        } catch (e) {
            console.error('Error downloading file:', e);
            alert('Error downloading file: ' + e.message);
        }
    };

    const handleUploadClick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                setUploadFile(file);
                performUpload(file);
            }
        };
        input.click();
    };

    const performUpload = async (file) => {
        setUploading(true);
        try {
            // Get auth token
            const tokenCandidates = ['chatops_token', 'auth_token', 'jwt', 'access_token'];
            let bearer = null;
            for (const k of tokenCandidates) {
                const v = localStorage.getItem(k);
                if (v) {
                    bearer = v;
                    break;
                }
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', currentPath);

            const headers = {};
            if (bearer) headers['Authorization'] = `Bearer ${bearer}`;

            const response = await fetch(`${apiBase}/api/storage/local/upload?path=${encodeURIComponent(currentPath)}`, {
                method: 'POST',
                headers,
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                alert(`Upload successful: ${data.filename} (${data.size})`);
                // Refresh directory
                await loadDirectory(currentPath);
            } else {
                const error = await response.json();
                alert('Upload failed: ' + (error.detail || response.statusText));
            }
        } catch (e) {
            console.error('Error uploading file:', e);
            alert('Error uploading file: ' + e.message);
        } finally {
            setUploading(false);
            setUploadFile(null);
        }
    };

    return (
        <div className="p-6 space-y-6">
            {/* Storage Stats */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-violet-400" />
                        <span className="text-sm font-semibold text-slate-200">D:\ Storage</span>
                    </div>
                    <button onClick={() => loadStorageStats()} className="p-1.5 rounded-lg hover:bg-slate-800/70 transition-colors">
                        <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                {storageStats && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-[11px]">
                            <span className="text-slate-500">Used: {storageStats.used}</span>
                            <span className="text-slate-500">Free: {storageStats.free}</span>
                        </div>
                        <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                            <div style={{ width: `${storageStats.usedPercent}%` }} className="h-full bg-gradient-to-r from-violet-600 to-sky-600" />
                        </div>
                        <div className="text-[10px] text-slate-600 text-center">{storageStats.usedPercent}% of {storageStats.total}</div>
                    </div>
                )}
            </div>

            {/* File Browser */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
                {/* Breadcrumb & Search */}
                <div className="p-4 border-b border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-[12px] text-slate-400">
                        <HardDrive className="w-3.5 h-3.5" />
                        {currentPath.split('\\').filter(Boolean).map((part, i, arr) => (
                            <React.Fragment key={i}>
                                <button
                                    onClick={() => {
                                        const targetPath = arr.slice(0, i + 1).join('\\') + '\\';
                                        setCurrentPath(targetPath);
                                    }}
                                    className="hover:text-violet-400 transition-colors"
                                >
                                    {part}
                                </button>
                                {i < arr.length - 1 && <ChevronRight className="w-3 h-3" />}
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search files by name..."
                                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-[12px] focus:outline-none focus:border-violet-500/70"
                            />
                        </div>
                        <button
                            onClick={handleUploadClick}
                            disabled={uploading}
                            className="px-3 py-2 rounded-lg bg-violet-600/80 hover:bg-violet-600 text-white text-[12px] flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            {uploading ? 'Uploading...' : 'Upload'}
                        </button>
                        {currentPath !== 'D:\\' && (
                            <button onClick={navigateUp} className="px-3 py-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-300 text-[12px] hover:bg-slate-700/70">
                                Up
                            </button>
                        )}
                    </div>
                </div>

                {/* File List */}
                <div className="max-h-96 overflow-y-auto divide-y divide-slate-800">
                    {loading && (
                        <div className="px-4 py-8 text-center text-[12px] text-slate-500">
                            <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2" />
                            Loading...
                        </div>
                    )}
                    {!loading && filteredFiles.length === 0 && (
                        <div className="px-4 py-8 text-center text-[12px] text-slate-500">
                            {searchQuery ? 'No files match your search.' : 'This folder is empty.'}
                        </div>
                    )}
                    {!loading && filteredFiles.map((file, idx) => (
                        <div
                            key={idx}
                            className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-900/60 transition-colors ${selectedFile?.name === file.name ? 'bg-slate-900/80' : ''}`}
                        >
                            <button
                                onClick={() => handleFileClick(file)}
                                className="flex-1 flex items-center gap-3 text-left min-w-0"
                            >
                                {getFileIcon(file)}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[13px] text-slate-300 truncate">{file.name}</span>
                                        {getAiRelevanceBadge(file.aiRelevance)}
                                    </div>
                                    <div className="text-[10px] text-slate-500 flex gap-3">
                                        <span>{file.size}</span>
                                        <span>{file.modified}</span>
                                    </div>
                                </div>
                                {file.type === 'folder' && <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
                            </button>
                            {file.type === 'file' && (
                                <button
                                    onClick={() => handleDownload(file)}
                                    className="p-2 rounded-lg hover:bg-slate-800/70 text-slate-400 hover:text-violet-400 transition-colors"
                                    title="Download file"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* AI Context Panel */}
            {selectedFile && aiContext && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Code className="w-4 h-4 text-violet-400" />
                        <span className="text-sm font-semibold text-slate-200">AI Context: {selectedFile.name}</span>
                    </div>
                    <div className="text-[12px] text-slate-400 leading-relaxed">{aiContext.summary}</div>
                    <div className="flex flex-wrap gap-2">
                        {aiContext.tags.map((tag, i) => (
                            <span key={i} className="text-[10px] px-2 py-1 rounded bg-slate-800/70 text-slate-400 border border-slate-700">
                                {tag}
                            </span>
                        ))}
                    </div>
                    {aiContext.relatedFiles.length > 0 && (
                        <div>
                            <div className="text-[10px] text-slate-500 mb-1.5">Related Files:</div>
                            <div className="flex flex-wrap gap-2">
                                {aiContext.relatedFiles.map((rf, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            const relatedFile = files.find(f => f.name === rf);
                                            if (relatedFile) handleFileClick(relatedFile);
                                        }}
                                        className="text-[11px] px-2 py-1 rounded bg-violet-600/20 text-violet-400 border border-violet-600/30 hover:bg-violet-600/30 transition-colors"
                                    >
                                        {rf}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Info Box */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <div className="text-[11px] text-slate-500 leading-relaxed space-y-1">
                    <div>💡 <span className="text-slate-400">AI+ badges indicate files with high contextual relevance for AI workflows.</span></div>
                    <div>🔍 <span className="text-slate-400">Click files to view summaries and related resources.</span></div>
                    <div>📂 <span className="text-slate-400">Upload files to current directory or download files via D:\ drive access.</span></div>
                    <div>🔒 <span className="text-slate-400">All operations restricted to D:\ drive with authentication required.</span></div>
                </div>
            </div>
        </div>
    );
}

export default CloudPanel;
