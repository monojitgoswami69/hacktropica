"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatBytes, cn } from '../../../utils/helpers';
import { api } from '../../../services/api';
import { FileTypeIcon, TypeBadge, FilePreview } from '../../../components/UI/FileComponents';
import { ConfirmationModal } from '../../../components/UI/ConfirmationModal';
import { LoadingSpinner } from '../../../components/UI/LoadingSpinner';
import { useToast } from '../../../context/ToastContext';
import { useAuth } from '../../../context/AuthContext';
import { useDebounce } from '../../../hooks/useHooks';
import {
  FileText,
  CheckCircle,
  HardDrive,
  Clock,
  Search,
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
  Layers,
} from "lucide-react";

// --- Helper Components ---

function MetricCard({ title, value, icon: Icon, colorClass, bgClass, index = 0, loading = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="bg-white p-3 rounded-lg border border-neutral-200"
    >
      <div className="flex items-center gap-2.5">
        <div className={cn("p-2 rounded-lg", bgClass)}>
          <Icon className={cn("w-4 h-4", colorClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-neutral-500 font-semibold text-[11px] uppercase tracking-wide block">{title}</span>
          {loading ? (
            <div className="h-6 w-12 bg-neutral-100 rounded animate-pulse mt-1" />
          ) : (
            <span className="text-xl font-bold text-neutral-900 tracking-tight block">{value}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Combined Metrics Card for Mobile
function CombinedMetricsCard({ metrics, loading = false }) {
  return (
    <div className="sm:hidden bg-white rounded-lg border border-neutral-200 p-3">
      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        <div className="text-center">
          <div className="w-6 h-6 sm:w-8 sm:h-8 mx-auto bg-blue-50 rounded-lg flex items-center justify-center mb-1">
            <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
          </div>
          {loading ? (
            <div className="h-4 sm:h-6 w-6 sm:w-8 mx-auto bg-neutral-200 rounded animate-pulse mb-1" />
          ) : (
            <div className="text-sm sm:text-lg font-bold text-neutral-900">{metrics.total}</div>
          )}
          <div className="text-[7px] sm:text-[9px] text-neutral-500 whitespace-pre-line leading-tight">{"Total\nDocs"}</div>
        </div>
        <div className="text-center">
          <div className="w-6 h-6 sm:w-8 sm:h-8 mx-auto bg-purple-50 rounded-lg flex items-center justify-center mb-1">
            <Layers className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600" />
          </div>
          {loading ? (
            <div className="h-4 sm:h-6 w-6 sm:w-8 mx-auto bg-neutral-200 rounded animate-pulse mb-1" />
          ) : (
            <div className="text-sm sm:text-lg font-bold text-neutral-900">{metrics.chunks}</div>
          )}
          <div className="text-[7px] sm:text-[9px] text-neutral-500 whitespace-pre-line leading-tight">{"Total\nChunks"}</div>
        </div>
        <div className="text-center">
          <div className="w-6 h-6 sm:w-8 sm:h-8 mx-auto bg-green-50 rounded-lg flex items-center justify-center mb-1">
            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
          </div>
          {loading ? (
            <div className="h-4 sm:h-6 w-6 sm:w-8 mx-auto bg-neutral-200 rounded animate-pulse mb-1" />
          ) : (
            <div className="text-sm sm:text-lg font-bold text-neutral-900">{metrics.dimension}</div>
          )}
          <div className="text-[7px] sm:text-[9px] text-neutral-500 whitespace-pre-line leading-tight">{"Vector\nDim"}</div>
        </div>
      </div>
    </div>
  );
}

// --- Main Page Component ---

export default function KnowledgeBasePage() {
  const { addToast, updateToast } = useToast();
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [serverStatus, setServerStatus] = useState('online');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [previewDoc, setPreviewDoc] = useState(null);
  
  // Check if user is assistant (view-only)
  const isAssistant = user?.role === 'assistant';

  // Dashboard metrics from API
  const [dashboardMetrics, setDashboardMetrics] = useState({
    total: 0,
    chunks: 0,
    dimension: 0,
  });

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null, // 'single' or 'bulk'
    doc: null,
  });

  const [loading, setLoading] = useState(true);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [error, setError] = useState(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Load stats from backend /api/v1/stats
  const loadDashboardStats = useCallback(async () => {
    setMetricsLoading(true);
    try {
      const response = await api.health.getStats();
      setDashboardMetrics({
        total: response.total_documents || 0,
        chunks: response.total_chunks || 0,
        dimension: response.vector_dimension || 0,
      });
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  // Load documents from backend /api/v1/documents
  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.documents.list();

      // Transform API response - backend returns { documents: [...], total: N }
      const docs = (response.documents || []).map((doc, i) => {
        const source = doc.source || 'Unknown';
        const ext = source.split('.').pop().toLowerCase();
        
        // Determine type category for icon styling
        let type = 'default';
        if (ext === 'pdf') type = 'pdf';
        else if (['doc', 'docx'].includes(ext)) type = 'docx';
        else if (['xls', 'xlsx', 'csv'].includes(ext)) type = 'xlsx';
        else if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) type = 'image';
        else if (['txt', 'md'].includes(ext)) type = 'text';

        return {
          id: doc.document_id,
          name: doc.title || doc.source || 'Untitled',
          source: doc.source,
          type: type,
          ext: ext,
          semester: doc.semester,
          stream: doc.stream,
          subject: doc.subject,
          chunks: doc.chunks || 0,
          uploadDate: doc.created_at || new Date().toISOString(),
          download_url: doc.download_url || null,
          status: 'active',
        };
      });

      setDocuments(docs);
      setServerStatus('online');
    } catch (err) {
      console.error("Failed to load documents:", err);
      setError('Failed to load documents');
      setServerStatus('offline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
    loadDashboardStats();
  }, [loadDocuments, loadDashboardStats]);

  // Listen for data changes
  useEffect(() => {
    const handleRefresh = () => {
      loadDocuments();
      loadDashboardStats();
    };

    window.addEventListener('refresh:knowledge-base', handleRefresh);
    window.addEventListener('data-changed', handleRefresh);
    return () => {
      window.removeEventListener('refresh:knowledge-base', handleRefresh);
      window.removeEventListener('data-changed', handleRefresh);
    };
  }, [loadDocuments, loadDashboardStats]);

  // Filter logic
  const filteredDocs = useMemo(() => {
    let docs = documents;

    if (debouncedSearch) {
      docs = docs.filter((doc) =>
        doc.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        (doc.source || '').toLowerCase().includes(debouncedSearch.toLowerCase())
      );
    }

    return docs;
  }, [debouncedSearch, documents]);

  const metrics = useMemo(() => {
    return {
      total: dashboardMetrics.total,
      chunks: dashboardMetrics.chunks,
      dimension: dashboardMetrics.dimension,
    };
  }, [dashboardMetrics]);

  // Open confirmation modal for single delete
  const handleDeleteClick = (doc) => {
    setConfirmModal({
      isOpen: true,
      type: 'single',
      doc: doc,
    });
  };

  // Execute single delete after confirmation
  const handleDeleteConfirm = async () => {
    const fileName = confirmModal.doc?.name || 'file';
    closeConfirmModal();

    const toastId = addToast({
      action: 'Deleting',
      fileName: fileName,
      status: 'processing',
      progress: 0,
    });

    try {
      updateToast(toastId, { status: 'processing', progress: 30 });

      if (confirmModal.doc) {
        await api.documents.delete(confirmModal.doc.id);
        setDocuments(prev => prev.filter(d => d.id !== confirmModal.doc.id));
      }

      loadDashboardStats();
      updateToast(toastId, {
        status: 'complete',
        action: 'Deleted',
        progress: 100,
      });
    } catch (err) {
      console.error('Failed to delete document:', err);
      updateToast(toastId, {
        status: 'error',
        action: 'Delete failed',
        message: err.message || 'Delete failed. Please try again.',
      });
    }
  };

  // Close confirmation modal
  const closeConfirmModal = () => {
    setConfirmModal({ isOpen: false, type: null, doc: null });
  };

  const toggleSelection = (id) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    const allSelected = filteredDocs.length > 0 &&
      filteredDocs.every(d => selectedIds.has(d.id));

    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocs.map(d => d.id)));
    }
  };

  // Open confirmation modal for bulk delete
  const handleBulkDeleteClick = () => {
    setConfirmModal({
      isOpen: true,
      type: 'bulk',
      doc: null,
    });
  };

  // Execute bulk delete after confirmation
  const handleBulkDeleteConfirm = async () => {
    const totalFiles = selectedIds.size;
    closeConfirmModal();

    let currentFileName = '';
    let maxFileNameLength = 0;
    const docsToDelete = documents.filter(d => selectedIds.has(d.id));
    maxFileNameLength = Math.max(...docsToDelete.map(d => d.name?.length || 0));
    currentFileName = docsToDelete[0]?.name || 'file';

    const toastId = addToast({
      action: 'Deleting',
      fileName: currentFileName,
      status: 'processing',
      progress: 0,
      type: 'delete',
      bulkProgress: { current: 1, total: totalFiles },
      _maxFileNameLength: maxFileNameLength,
    });

    try {
      let completedCount = 0;

      for (const doc of docsToDelete) {
        await api.documents.delete(doc.id);
        completedCount++;
        
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
        setSelectedIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(doc.id);
          return newSet;
        });
        
        if (completedCount < totalFiles && docsToDelete[completedCount]) {
          currentFileName = docsToDelete[completedCount].name;
        }
        
        updateToast(toastId, {
          status: 'processing',
          progress: Math.floor((completedCount / totalFiles) * 100),
          fileName: currentFileName,
          bulkProgress: { current: completedCount + 1, total: totalFiles },
        });
      }

      loadDashboardStats();
      updateToast(toastId, {
        status: 'complete',
        action: 'Deleted',
        fileName: `${totalFiles} files`,
        progress: 100,
        bulkProgress: null,
      });
    } catch (err) {
      console.error('Failed to bulk delete:', err);
      updateToast(toastId, {
        status: 'error',
        action: 'Delete failed',
        message: err.message || 'Delete failed. Please try again.',
      });
    }
  };

  // Get selected file names for bulk confirmation
  const getSelectedFileNames = () => {
    return documents.filter(d => selectedIds.has(d.id)).map(d => d.name);
  };

  const handleSaveDocument = async (doc, newContent) => {
    try {
      await loadDocuments();
      await loadDashboardStats();
    } catch (err) {
      console.error('Failed to reload after edit:', err);
      throw err;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Sticky Header Section */}
      <div className="flex-shrink-0 space-y-3 mb-3 px-1">
        {/* Metrics - Combined on mobile, grid on desktop */}
        <CombinedMetricsCard metrics={metrics} loading={metricsLoading} />

        {/* Metrics Grid - Desktop only */}
        <div className="hidden sm:grid grid-cols-3 gap-3">
          <MetricCard
            title="Total Documents"
            value={metrics.total}
            icon={FileText}
            bgClass="bg-blue-50"
            colorClass="text-blue-600"
            index={0}
            loading={metricsLoading}
          />
          <MetricCard
            title="Total Chunks"
            value={metrics.chunks}
            icon={Layers}
            bgClass="bg-purple-50"
            colorClass="text-purple-600"
            index={1}
            loading={metricsLoading}
          />
          <MetricCard
            title="Vector Dimension"
            value={metrics.dimension}
            icon={CheckCircle}
            bgClass="bg-green-50"
            colorClass="text-green-600"
            index={2}
            loading={metricsLoading}
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search documents..."
              className="w-full pl-8 sm:pl-9 pr-3 sm:pr-4 py-2 bg-white border-2 border-neutral-300/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-neutral-900 placeholder-neutral-400 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-1.5 sm:gap-2 justify-center sm:justify-start flex-wrap">
            <button
              onClick={handleBulkDeleteClick}
              disabled={selectedIds.size === 0 || isAssistant}
              className={cn(
                "px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 sm:gap-2 min-h-[36px]",
                selectedIds.size > 0 && !isAssistant
                  ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                  : "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed"
              )}
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Delete</span> {selectedIds.size > 0 && `(${selectedIds.size})`}
            </button>
            <button
              onClick={() => { loadDocuments(); loadDashboardStats(); }}
              disabled={loading || metricsLoading}
              className="hidden lg:flex p-1.5 sm:p-2 rounded-lg text-sm font-medium transition-colors bg-neutral-100 text-neutral-600 border border-neutral-200 hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] min-w-[36px] items-center justify-center"
              title="Refresh"
            >
              <RefreshCw className={cn("w-4 h-4", (loading || metricsLoading) && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 min-h-0 px-0.5 sm:px-1">
        <div className="bg-white rounded-lg border border-neutral-200 overflow-hidden h-full flex flex-col">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full table-fixed min-w-[280px]">
              {filteredDocs.length > 0 && (
                <thead className="sticky top-0 z-10 bg-neutral-50">
                  <tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="w-8 xs:w-10 sm:w-12 pl-2 xs:pl-3 sm:pl-4 pr-1 sm:pr-2 py-2 text-center align-middle">
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          type="checkbox"
                          className="rounded border-neutral-300 text-primary-600 w-3.5 h-3.5 sm:w-4 sm:h-4"
                          checked={filteredDocs.length > 0 && filteredDocs.every(d => selectedIds.has(d.id))}
                          onChange={toggleAll}
                        />
                        <span className="text-[7px] xs:text-[8px] sm:text-[9px] font-medium text-neutral-400 uppercase">All</span>
                      </div>
                    </th>
                    <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider align-middle">Document</th>
                    <th className="hidden md:table-cell w-16 sm:w-20 px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider align-middle">Semester</th>
                    <th className="hidden lg:table-cell w-16 sm:w-20 px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider align-middle">Stream</th>
                    <th className="hidden lg:table-cell w-16 sm:w-20 px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider align-middle">Subject</th>
                    <th className="hidden lg:table-cell w-16 sm:w-20 px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider align-middle">Chunks</th>
                    <th className="w-[70px] xs:w-[80px] sm:w-[100px] pl-2 sm:pl-3 pr-2 xs:pr-3 sm:pr-4 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-semibold text-neutral-500 uppercase tracking-wider align-middle">Actions</th>
                  </tr>
                </thead>
              )}
              <tbody className="divide-y divide-neutral-100">
                {!loading && filteredDocs.map((doc, index) => (
                  <motion.tr
                    key={doc.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: index * 0.02 }}
                    className={cn("hover:bg-neutral-50 transition-colors", selectedIds.has(doc.id) && "bg-primary-50")}
                  >
                    <td className={cn("w-8 xs:w-10 sm:w-12 pl-2 xs:pl-3 sm:pl-4 pr-1 sm:pr-2 py-2 sm:py-3 text-center align-middle", selectedIds.has(doc.id) && "border-l-2 border-l-primary-500")}>
                      <input
                        type="checkbox"
                        className="rounded border-neutral-300 text-primary-600 w-3.5 h-3.5 sm:w-4 sm:h-4"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelection(doc.id)}
                      />
                    </td>
                    <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 align-middle">
                      <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 min-w-0">
                        <div className="flex-shrink-0 hidden sm:block">
                          <FileTypeIcon ext={doc.ext} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="font-medium sm:font-semibold text-neutral-900 hover:text-blue-600 text-left transition-colors text-xs sm:text-sm break-words w-full line-clamp-2"
                            title={doc.name}
                          >
                            {doc.name}
                          </button>
                          {doc.source && doc.source !== doc.name && (
                            <p className="text-[10px] sm:text-xs text-neutral-400 truncate">{doc.source}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell w-16 sm:w-20 px-2 sm:px-3 py-2 sm:py-3 text-center align-middle">
                      {doc.semester ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {doc.semester}
                        </span>
                      ) : (
                        <span className="text-neutral-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell w-16 sm:w-20 px-2 sm:px-3 py-2 sm:py-3 text-center align-middle">
                      {doc.stream ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-green-50 text-green-700 border border-green-200 uppercase">
                          {doc.stream}
                        </span>
                      ) : (
                        <span className="text-neutral-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell w-16 sm:w-20 px-2 sm:px-3 py-2 sm:py-3 text-center align-middle">
                      {doc.subject ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-200">
                          {doc.subject}
                        </span>
                      ) : (
                        <span className="text-neutral-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="hidden lg:table-cell w-16 sm:w-20 px-2 sm:px-3 py-2 sm:py-3 text-xs sm:text-sm text-neutral-600 text-center align-middle">
                      {doc.chunks}
                    </td>
                    <td className="w-[70px] xs:w-[80px] sm:w-[100px] pl-2 sm:pl-3 pr-2 xs:pr-3 sm:pr-4 py-2 sm:py-3 align-middle">
                      <div className="flex items-center justify-center gap-1 flex-nowrap">
                        <button
                          onClick={() => handleDeleteClick(doc)}
                          disabled={isAssistant}
                          className="px-2 sm:px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-50"
                        >
                          <span className="hidden sm:inline">Delete</span>
                          <Trash2 className="sm:hidden w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}

                {filteredDocs.length === 0 && !loading && (
                  <tr className="h-full">
                    <td colSpan="7" className="h-full">
                      <div className="flex flex-col items-center justify-center text-center text-neutral-500 min-h-[400px]">
                        <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mb-3">
                          <Search className="w-6 h-6 text-neutral-400" />
                        </div>
                        <p className="font-medium">No documents found</p>
                        <p className="text-sm mt-1">Try adjusting your search or add new documents</p>
                      </div>
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan="7" className="px-6 py-10 text-neutral-500">
                      <LoadingSpinner text="Loading documents..." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.type === 'bulk' ? handleBulkDeleteConfirm : handleDeleteConfirm}
        title={confirmModal.type === 'bulk' ? 'Delete Selected Documents' : 'Delete Document'}
        message={
          confirmModal.type === 'bulk'
            ? `Are you sure you want to permanently delete ${selectedIds.size} document${selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.`
            : `Are you sure you want to permanently delete "${confirmModal.doc?.name}"? This action cannot be undone.`
        }
        actionType="delete"
        confirmLabel="Delete"
        itemNames={confirmModal.type === 'bulk' ? getSelectedFileNames() : []}
      />

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <FilePreview
            doc={previewDoc}
            onClose={() => setPreviewDoc(null)}
            onSave={handleSaveDocument}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
