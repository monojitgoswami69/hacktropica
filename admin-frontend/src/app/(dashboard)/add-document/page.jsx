"use client";

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../../components/UI/Button';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { validateFile, formatBytes, cn } from '../../../utils/helpers';
import { api } from '../../../services/api';
import { useFilters } from '../../../hooks/useFilters';
import { 
  FileUp, 
  FolderUp, 
  X, 
  FileText, 
  Upload,
  AlertCircle,
  GraduationCap,
  BookOpen,
  Layers
} from 'lucide-react';

import { FilterDropdown } from '../../../components/UI/FilterDropdown';

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } }
};

const cardVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } }
};

const fileItemVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } }
};

// Filter selector values
export default function AddDocumentPage() {
  
  const { addToast, updateToast } = useToast();
    const { user } = useAuth();
    const { data: filterData } = useFilters();
    const curriculum = filterData?.curriculum || {};
    

    const [uploadMode, setUploadMode] = useState('file'); // 'file' | 'folder'
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState('');
    const [serverStatus, setServerStatus] = useState('online');
    const [uploading, setUploading] = useState(false);

    // Filter state
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedStream, setSelectedStream] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');

    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    useEffect(() => {
      // Handle setting stream right at initial load
      if (user?.stream) {
        setSelectedStream(user.stream.toLowerCase());
      }
    }, [user?.stream]);

  const uploadModes = [
    { id: 'file', label: 'Single File', icon: FileUp, description: 'Upload individual documents' },
    { id: 'folder', label: 'Folder', icon: FolderUp, description: 'Upload multiple files' },
  ];

  const acceptedFormats = {
    file: '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.json,.docx,.pptx',
    folder: '',
  };

  const formatLabels = {
    file: 'PDF, Images (PNG, JPG, JPEG, WEBP), Text (TXT, MD), JSON, DOCX, PPTX',
    folder: 'All supported file types in folder',
  };

  // Drag Handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFilesSelect(files);
    }
  };

  // Select Files
  const handleFilesSelect = (files) => {
    const validFiles = [];
    const skippedFiles = [];
    const errors = [];

    files.forEach(file => {
      const validation = validateFile(file);
      if (validation.valid) {
        validFiles.push(file);
      } else if (validation.error === 'File type not supported') {
        skippedFiles.push(file.name);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    });

    if (skippedFiles.length > 0) {
      const skippedMessage = skippedFiles.map(name => `skipped ${name}, type unsupported`).join('\n');
      if (errors.length > 0) {
        setError(skippedMessage + '\n' + errors.join('\n'));
      } else {
        setError(skippedMessage);
      }
    } else if (errors.length > 0) {
      setError(errors.join('\n'));
    } else {
      setError('');
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
    }
  };

  const handleInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFilesSelect(files);
    }
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setError('');
  };

  const getActiveInputRef = () => {
    switch (uploadMode) {
      case 'folder': return folderInputRef;
      default: return fileInputRef;
    }
  };

  // Upload files to backend via ingest API
  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setError('');

    let toastId = null;

    const filterOptions = {
      semester: selectedSemester || null,
      stream: selectedStream || null,
      subject: selectedSubject || null,
    };

    try {
      let result;
      
      if (selectedFiles.length > 1) {
        // Multiple files upload
        let completedCount = 0;
        const totalCount = selectedFiles.length;
        let currentFileName = selectedFiles[0]?.name || '';
        
        const maxFileNameLength = Math.max(...selectedFiles.map(f => f.name.length));
        
        const filesToUpload = [...selectedFiles];
        setSelectedFiles([]);
        setError('');
        
        toastId = addToast({
          action: 'Uploading',
          fileName: currentFileName,
          status: 'uploading',
          progress: 0,
          bulkProgress: { current: 1, total: totalCount },
          _maxFileNameLength: maxFileNameLength,
        });
        
        result = await api.upload.multiple(filesToUpload, filterOptions, (status, progress, fileIndex) => {
          if (status === 'complete' && fileIndex !== undefined) {
            completedCount++;
            if (completedCount < totalCount && filesToUpload[completedCount]) {
              currentFileName = filesToUpload[completedCount].name;
            }
          }
          updateToast(toastId, {
            status: 'uploading',
            progress: progress,
            fileName: currentFileName,
            bulkProgress: { current: completedCount + 1, total: totalCount },
          });
        });
        
        if (result.status === 'success' || result.results) {
          updateToast(toastId, {
            status: 'complete',
            action: 'Uploaded',
            progress: 100,
            fileName: `${totalCount} files`,
            bulkProgress: null,
          });
          // Trigger knowledge base refresh
          window.dispatchEvent(new CustomEvent('data-changed', { detail: { type: 'upload' } }));
        } else {
          updateToast(toastId, {
            status: 'error',
            action: 'Upload failed',
            message: result.message || 'Upload failed',
          });
          setError(result.message || 'Upload failed');
        }
      } else {
        // Single file upload
        const file = selectedFiles[0];
        
        toastId = addToast({
          action: 'Uploading',
          fileName: file.name,
          status: 'uploading',
          progress: 0,
        });
        
        const fileToUpload = selectedFiles[0];
        setSelectedFiles([]);
        setError('');
        
        result = await api.upload.file(fileToUpload, {
          title: fileToUpload.name,
          ...filterOptions,
        }, (status, progress) => {
          updateToast(toastId, {
            status: 'uploading',
            progress: progress,
          });
        });
        
        if (result.status === 'success' || result.document_id) {
          updateToast(toastId, {
            status: 'complete',
            action: 'Uploaded',
            progress: 100,
          });
          // Trigger knowledge base refresh
          window.dispatchEvent(new CustomEvent('data-changed', { detail: { type: 'upload' } }));
        } else {
          updateToast(toastId, {
            status: 'error',
            action: 'Upload failed',
            message: result.message || 'Upload failed',
          });
          setError(result.message || 'Upload failed');
        }
      }
      
      setServerStatus('online');
    } catch (err) {
      console.error('Upload error:', err);
      
      if (toastId) {
        updateToast(toastId, {
          status: 'error',
          action: 'Upload failed',
          message: err.message || 'Upload failed',
        });
      }
      
      if (err.message?.includes('Network') || err.message?.includes('fetch') || err.status === 0) {
        setServerStatus('offline');
        setError('Server is offline. Please try again later.');
      } else if (err.status === 503) {
        setError('Service temporarily unavailable. Please try again later.');
      } else {
        setError(err.message || 'Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);


const streamOptions = [{ value: '', label: 'General' }, ...Object.keys(curriculum).map(s => ({ value: s, label: s.toUpperCase() }))];
    const semOptions = [{ value: '', label: 'General' }, ...(selectedStream && curriculum[selectedStream] ? Object.keys(curriculum[selectedStream]).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    }).map(s => ({ value: s, label: s })) : [])];
    const subjectOptions = [{ value: '', label: 'General' }, ...(selectedStream && selectedSemester && curriculum[selectedStream]?.[selectedSemester] ? curriculum[selectedStream][selectedSemester].map(s => ({ value: s, label: s })) : [])];

  return (
    <motion.div 
      className="h-full w-full flex flex-col overflow-hidden"
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="space-y-3 p-1">
      
      <AnimatePresence>
        {serverStatus === 'offline' && (
          <motion.div 
            className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg flex items-center gap-2"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <AlertCircle className="w-5 h-5" />
            <span>Server is offline. Uploads are disabled.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Mode Selector */}
      <div className="bg-white rounded-lg border border-neutral-200 p-2">
        <div className="flex gap-1">
          {uploadModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                setUploadMode(mode.id);
                clearAll();
              }}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors",
                uploadMode === mode.id
                  ? "bg-primary-500 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              )}
            >
              <mode.icon className="w-4 h-4" />
              <span className="text-[11px] tracking-wide">{mode.id === 'file' ? 'Files' : 'Folder'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filter Selectors */}
      <motion.div 
        className="bg-white rounded-lg border border-neutral-200 p-4"
        variants={cardVariants}
      >
        <h2 className="text-[15px] font-bold text-neutral-900 tracking-tight mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary-600" />
          Document Metadata
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Semester Selector */}
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              Semester
            </label>
            <FilterDropdown
              value={selectedSemester}
              onChange={(val) => { setSelectedSemester(val); setSelectedSubject(""); }}
              options={semOptions}
              placeholder="General"
            />
          </div>

          {/* Stream Selector */}
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Stream
            </label>
            <FilterDropdown
              value={selectedStream}
              onChange={(val) => { setSelectedStream(val); setSelectedSemester(""); setSelectedSubject(""); }}
              options={streamOptions}
              disabled={!!user?.stream}
              placeholder="General"
            />
          </div>

          {/* Subject Selector */}
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-500 uppercase tracking-wide mb-1.5">
              <FileText className="w-3.5 h-3.5" />
              Subject
            </label>
            <FilterDropdown
              value={selectedSubject}
              onChange={(val) => setSelectedSubject(val)}
              options={subjectOptions}
              placeholder="General"
            />
          </div>
        </div>

        {/* Active Filters Display */}
        {(selectedSemester || selectedStream || selectedSubject) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium text-neutral-400 uppercase">Active:</span>
            {selectedSemester && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {selectedSemester} Semester
                <button onClick={() => setSelectedSemester('')} className="hover:text-blue-900"><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedStream && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700 border border-green-200">
                {selectedStream.toUpperCase()}
                <button onClick={() => setSelectedStream('')} className="hover:text-green-900"><X className="w-3 h-3" /></button>
              </span>
            )}
            {selectedSubject && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                {selectedSubject}
                <button onClick={() => setSelectedSubject('')} className="hover:text-yellow-900"><X className="w-3 h-3" /></button>
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* Upload Area */}
      <div className="bg-white rounded-lg border border-neutral-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-neutral-900 tracking-tight">
            Upload {uploadMode === 'file' ? 'Document' : 'Folder'}
          </h2>
          {selectedFiles.length > 0 && (
            <button onClick={clearAll} className="text-[13px] text-neutral-500 hover:text-neutral-700 font-medium">
              Clear all
            </button>
          )}
        </div>

        {/* Dropzone */}
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            dragActive
              ? "border-primary-500 bg-primary-50"
              : error
              ? "border-red-300 bg-red-50"
              : "border-neutral-300 hover:border-primary-400 bg-neutral-50"
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => {
            const ref = getActiveInputRef();
            if (ref.current) ref.current.click();
          }}
        >
          {/* Hidden Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats.file}
            multiple
            onChange={handleInputChange}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleInputChange}
            className="hidden"
          />

          <div className="flex flex-col items-center">
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center mb-4",
              dragActive ? "bg-primary-100" : "bg-neutral-100"
            )}>
              <Upload className={cn(
                "w-7 h-7",
                dragActive ? "text-primary-600" : "text-neutral-400"
              )} />
            </div>
            <p className="text-[15px] font-semibold mb-1 text-neutral-900 tracking-tight">
              {dragActive ? 'Drop files here' : 'Drag and drop, or click to browse'}
            </p>
            <p className="text-[13px] text-neutral-500">
              {formatLabels[uploadMode]}
            </p>
          </div>
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-neutral-700 tracking-tight">
                Selected Files ({selectedFiles.length})
              </h3>
              <span className="text-[13px] text-neutral-500">
                Total: {formatBytes(totalSize)}
              </span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              <AnimatePresence mode="sync">
                {selectedFiles.map((file, index) => (
                  <motion.div 
                    key={file.name + index}
                    className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg border border-neutral-200 gap-2"
                    variants={fileItemVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    layout
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 bg-white rounded-lg border border-neutral-200 flex-shrink-0">
                        <FileText className="w-4 h-4 text-neutral-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-neutral-900 truncate text-[13px] tracking-tight">{file.name}</p>
                        <p className="text-[11px] text-neutral-500">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                      className="p-1.5 hover:bg-neutral-200 rounded-lg transition-colors"
                      title="Remove file"
                    >
                      <X className="w-4 h-4 text-neutral-500" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-[13px] text-red-700 whitespace-pre-line">{error}</p>
          </div>
        )}

        {/* Actions */}
        {selectedFiles.length > 0 && (
          <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="secondary" onClick={clearAll} className="w-full sm:w-auto justify-center">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={uploading || serverStatus === 'offline'} className="w-full sm:w-auto justify-center">
              <Upload className="w-4 h-4 mr-2" />
              Upload {selectedFiles.length > 1 ? `${selectedFiles.length} Files` : 'File'}
            </Button>
          </div>
        )}
      </div>
      </div>
      </div>
    </motion.div>
  );
}
