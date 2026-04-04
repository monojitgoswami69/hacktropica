"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../../services/api';
import { useFilters } from '../../../hooks/useFilters';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { cn } from '../../../utils/helpers';
import { FilterDropdown } from '../../../components/UI/FilterDropdown';
import { 
  FileText, 
  Upload, 
  X,
  GraduationCap,
  BookOpen,
  Layers
} from 'lucide-react';

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.3 } }
};

const cardVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2 } }
};

// Filter selector values
export default function AddTextPage() {
  const [text, setText] = useState('');
  const [filename, setFilename] = useState('');
  
  const { addToast, updateToast } = useToast();
    const { user } = useAuth();
    const { data: filterData } = useFilters();
    const curriculum = filterData?.curriculum || {};
    
    // Filter state
    const [selectedSemester, setSelectedSemester] = useState('');
    const [selectedStream, setSelectedStream] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');

    React.useEffect(() => {
      // Handle setting stream right at initial load
      if (user?.stream) {
        setSelectedStream(user.stream.toLowerCase());
      }
    }, [user?.stream]);

    const handleUpload = async () => {
      if (!text.trim()) return;

      let finalFilename;
      if (filename.trim()) {
        finalFilename = filename.trim().endsWith('.txt') ? filename.trim() : `${filename.trim()}.txt`;
      } else {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + Date.now();
      finalFilename = `text_${timestamp}.txt`;
    }

    const textContent = text;
    const filterOptions = {
      semester: selectedSemester || null,
      stream: selectedStream || null,
      subject: selectedSubject || null,
    };

    setText('');
    setFilename('');

    const toastId = addToast({
      action: 'Uploading',
      fileName: finalFilename,
      status: 'uploading',
      progress: 0,
    });

    try {
      updateToast(toastId, { status: 'uploading', progress: 30 });
      await api.text.upload(finalFilename, textContent, filterOptions);
      updateToast(toastId, { status: 'complete', action: 'Uploaded', progress: 100 });
      // Trigger knowledge base refresh
      window.dispatchEvent(new CustomEvent('data-changed', { detail: { type: 'upload' } }));
    } catch (err) {
      updateToast(toastId, {
        status: 'error',
        action: 'Upload failed',
        message: err.message || 'Failed to upload text',
      });
      setText(textContent);
    }
  };


const streamOptions = [{ value: '', label: 'General' }, ...Object.keys(curriculum).map(s => ({ value: s, label: s.toUpperCase() }))];
    const semOptions = [{ value: '', label: 'General' }, ...(selectedStream && curriculum[selectedStream] ? Object.keys(curriculum[selectedStream]).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    }).map(s => ({ value: s, label: s })) : [])];
    const subjectOptions = [{ value: '', label: 'General' }, ...(selectedStream && selectedSemester && curriculum[selectedStream]?.[selectedSemester] ? curriculum[selectedStream][selectedSemester].map(s => ({ value: s, label: s })) : [])];

  return (
    <motion.div
      className="h-full flex flex-col gap-3 min-h-0 overflow-hidden"
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {/* Filter Selectors */}
      <motion.div 
        className="bg-white rounded-lg border border-neutral-200 p-4 flex-shrink-0"
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

      {/* Text Editor */}
      <motion.div
        className="flex-1 min-h-[300px] sm:min-h-[400px] bg-white rounded-lg border border-neutral-200 flex flex-col overflow-hidden"
        variants={cardVariants}
      >
        <div className="p-3 border-b border-neutral-200 flex items-center gap-3 bg-neutral-50 flex-shrink-0">
          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="Filename (optional)"
            className="flex-1 min-w-0 px-3 py-2 text-[14px] border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            onClick={handleUpload}
            disabled={!text.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-[13px] font-semibold transition-colors tracking-tight"
          >
            <Upload className="w-4 h-4" />
            <span>Upload</span>
          </button>
        </div>

        <div className="flex-1 relative min-h-0">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="absolute inset-0 w-full h-full p-4 resize-none focus:outline-none font-mono text-[14px] leading-relaxed text-neutral-900 bg-white placeholder-neutral-400"
            placeholder="Paste your content here..."
          />
        </div>

        <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200 text-[11px] text-neutral-500 text-right flex-shrink-0 font-medium tracking-wide">
          {text.length} characters
        </div>
      </motion.div>
    </motion.div>
  );
}
