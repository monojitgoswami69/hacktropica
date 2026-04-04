"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../../../context/ToastContext";
import { API_BASE_URL } from "../../../services/api";
import {
  Plus,
  Trash2,
  X,
  Check,
  BookOpen,
  GraduationCap,
  Layers,
  ChevronRight,
  BookCopy,
  PlusCircle,
  Save
} from "lucide-react";
import { cn } from "../../../utils/helpers";
import RoleProtectedRoute from '../../../components/RoleProtectedRoute';

export default function ManageCurriculumPage() {
  const { addToast } = useToast();
  const [curriculum, setCurriculum] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedStream, setSelectedStream] = useState("");
  const [newStreamName, setNewStreamName] = useState("");
  const [subjectInputs, setSubjectInputs] = useState({});

  useEffect(() => {
    fetchCurriculum();
  }, []);

  const fetchCurriculum = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/filters`);
      const data = await res.json();
      if (data && data.curriculum) {
        setCurriculum(data.curriculum);
        const streams = Object.keys(data.curriculum);
        if (streams.length > 0) {
          setSelectedStream(streams[0]);
        }
      }
    } catch (err) {
      addToast({ type: "error", message: "Failed to load curriculum" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const auth_token =
        localStorage.getItem("admin_token") || sessionStorage.getItem("admin_token");
      const res = await fetch(`${API_BASE_URL}/api/v1/admin/curriculum`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth_token}`
        },
        body: JSON.stringify(curriculum)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save curriculum");
      }
      addToast({ type: "success", message: "Curriculum saved successfully" });
    } catch (err) {
      addToast({ type: "error", message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const addStream = () => {
    if (!newStreamName.trim()) return;
    const name = newStreamName.trim().toLowerCase();
    if (curriculum[name]) {
      addToast({ type: "warning", message: "Stream already exists." });
      return;
    }
    setCurriculum((prev) => ({ ...prev, [name]: { "sem 1": ["NA"] } }));
    setNewStreamName("");
    setSelectedStream(name);
  };

  const removeStream = (stream) => {
    if (!window.confirm(`Are you sure you want to remove the stream '${stream}'?`)) return;
    const updated = { ...curriculum };
    delete updated[stream];
    setCurriculum(updated);
    if (selectedStream === stream) {
      const remaining = Object.keys(updated);
      setSelectedStream(remaining.length > 0 ? remaining[0] : "");
    }
  };

  const addSemester = () => {
    if (!selectedStream) return;
    
    // Find the next semester number based on existing keys
    const currentSems = curriculum[selectedStream] ? Object.keys(curriculum[selectedStream]) : [];
    
    let maxSem = 0;
    currentSems.forEach(s => {
      // Extract number from format "sem X"
      const match = s.match(/sem\s+(\d+)/i);
      if (match && parseInt(match[1]) > maxSem) {
        maxSem = parseInt(match[1]);
      }
    });
    
    const nextSemNum = maxSem + 1;
    const newSemStr = `sem ${nextSemNum}`;
    
    const updated = { ...curriculum };
    if (!updated[selectedStream]) {
        updated[selectedStream] = {};
    }
    updated[selectedStream][newSemStr] = ["NA"];
    setCurriculum(updated);
  };

  const removeSem = (sem) => {
    if (!window.confirm(`Are you sure you want to remove '${sem}'?`)) return;
    const updated = { ...curriculum };
    delete updated[selectedStream][sem];
    setCurriculum(updated);
  };

  const handleSubjectInputChange = (sem, value) => {
    setSubjectInputs(prev => ({ ...prev, [sem]: value }));
  };

  const handleSubjectInputKeyDown = (e, sem) => {
    if (e.key === "Enter" && subjectInputs[sem]?.trim()) {
      addSubject(sem, subjectInputs[sem]);
    }
  };

  const addSubject = (sem, subName) => {
    const sub = subName.trim().toLowerCase();
    const currentSubs = curriculum[selectedStream][sem] || [];
    if (currentSubs.includes(sub)) {
      addToast({ type: "warning", message: "Subject already exists here." });
      return;
    }
    let newSubs = [...currentSubs, sub];
    if (newSubs.includes("NA") && newSubs.length > 1 && sub !== "NA") {
      newSubs = newSubs.filter((s) => s !== "NA");
    }
    const updated = { ...curriculum };
    updated[selectedStream][sem] = newSubs;
    setCurriculum(updated);
    setSubjectInputs(prev => ({ ...prev, [sem]: "" }));
  };

  const removeSubject = (sem, sub) => {
    const updated = { ...curriculum };
    updated[selectedStream][sem] = updated[selectedStream][sem].filter((s) => s !== sub);
    if (updated[selectedStream][sem].length === 0) {
      updated[selectedStream][sem] = ["NA"];
    }
    setCurriculum(updated);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-neutral-500 font-medium tracking-wide">Loading Curriculum...</p>
      </div>
    );
  }

  const streams = Object.keys(curriculum);
  let semesters = selectedStream && curriculum[selectedStream] ? Object.keys(curriculum[selectedStream]) : [];
  
  // Sort semesters logically
  semesters.sort((a, b) => {
    const numA = a.match(/sem\s+(\d+)/i) ? parseInt(a.match(/sem\s+(\d+)/i)[1]) : 0;
    const numB = b.match(/sem\s+(\d+)/i) ? parseInt(b.match(/sem\s+(\d+)/i)[1]) : 0;
    if (numA && numB) return numA - numB;
    return a.localeCompare(b);
  });

  return (
      <RoleProtectedRoute requiredRoles={['admin', 'superuser']} routeName="manage-curriculum">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-full overflow-y-auto bg-neutral-50 min-h-screen">
          
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-3">
                <BookCopy className="w-8 h-8 text-indigo-600" />
                Curriculum Manager
              </h1>
              <p className="text-sm text-neutral-500 mt-2 font-medium max-w-2xl">
                Design and organize your academic structures. Manage streams, semesters, and subjects globally.
              </p>
            </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-700 hover:shadow transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {saving ? (
            <span className="animate-pulse flex items-center gap-2"><Save className="w-4 h-4 animate-spin"/> Saving...</span>
          ) : (
            <>
              <Save className="w-4 h-4" /> Save Changes
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column: Streams Sidebar */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/60 overflow-hidden">
            <div className="p-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-xs font-bold text-neutral-700 uppercase tracking-widest">Active Streams</h2>
            </div>
            
            <div className="p-3 flex flex-col gap-1.5">
              {streams.map((str) => (
                <button
                  key={str}
                  onClick={() => setSelectedStream(str)}
                  className={cn(
                    "group flex items-center justify-between px-4 py-3 text-sm rounded-xl transition-all duration-200 text-left",
                    selectedStream === str
                      ? "bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold shadow-sm"
                      : "bg-transparent border border-transparent text-neutral-600 hover:bg-neutral-50 hover:border-neutral-200"
                  )}
                >
                  <span className="uppercase tracking-wider truncate mr-2">{str}</span>
                  <div className="flex items-center gap-2">
                    {selectedStream === str && <ChevronRight className="w-4 h-4 text-indigo-500" />}
                    <Trash2
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStream(str);
                      }}
                      className="w-4 h-4 opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-red-500 transition-opacity"
                    />
                  </div>
                </button>
              ))}

              <div className="mt-4 px-1 group">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Add New Stream..."
                    className="w-full pl-4 pr-10 py-2.5 text-sm bg-neutral-50 border border-neutral-200 rounded-xl focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all uppercase tracking-wider text-neutral-700 placeholder:text-neutral-400 placeholder:capitalize"
                    value={newStreamName}
                    onChange={(e) => setNewStreamName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addStream()}
                  />
                  <button 
                    onClick={addStream} 
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <PlusCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Semesters & Subjects */}
        <div className="xl:col-span-9">
          {selectedStream ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} key={selectedStream}>
              
              <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/60 p-6 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-7 h-7 text-indigo-600 bg-indigo-50 p-1.5 rounded-lg" />
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-800 uppercase tracking-widest truncate">
                        {selectedStream} Environment
                      </h2>
                      <p className="text-sm text-neutral-500 mt-0.5">Manage semesters and syllabus for this stream</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                      onClick={addSemester}
                      className="flex items-center gap-2 bg-white border border-indigo-200 text-indigo-700 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-50 hover:border-indigo-300 transition-all"
                    >
                      <Plus className="w-4 h-4" /> Add Semester
                    </button>
                  </div>
                </div>
              </div>

              {/* Semesters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {semesters.map((sem) => (
                    <motion.div 
                      layout 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.95 }} 
                      key={sem} 
                      className="bg-white rounded-2xl shadow-sm border border-neutral-200/60 overflow-hidden flex flex-col group/card hover:border-indigo-200 hover:shadow-md transition-all duration-300"
                    >
                      <div className="px-5 py-4 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between group-hover/card:bg-indigo-50/30 transition-colors">
                        <h3 className="text-base font-bold text-neutral-800 capitalize tracking-wide flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-indigo-500" />
                          {sem}
                        </h3>
                        <button
                          onClick={() => removeSem(sem)}
                          className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover/card:opacity-100 transition-all"
                          title="Remove Semester"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="p-5 flex-1 flex flex-col gap-3">
                        <div className="flex flex-col gap-2 mb-2 w-full">
                          {curriculum[selectedStream][sem].map((sub) => (
                            <div
                              key={sub}
                              className={cn(
                                "group/sub flex items-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-xl border transition-all justify-between w-full",
                                sub === "NA"
                                  ? "bg-amber-50 border-amber-200 text-amber-700 justify-center text-center"
                                  : "bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:border-neutral-300"
                              )}
                            >
                              <span className="capitalize truncate max-w-[85%]">{sub === "NA" ? "Empty Semester" : sub}</span>
                              {sub !== "NA" && (
                                <button
                                  onClick={() => removeSubject(sem, sub)}
                                  className="text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full p-1 transition-colors flex-shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Add Subject Input */}
                        <div className="mt-auto pt-4 relative border-t border-neutral-100">
                          <input
                            type="text"
                            placeholder="Add a subject..."
                            value={subjectInputs[sem] || ""}
                            onChange={(e) => handleSubjectInputChange(sem, e.target.value)}
                            onKeyDown={(e) => handleSubjectInputKeyDown(e, sem)}
                            className="w-full text-sm bg-neutral-50 border border-neutral-200 rounded-lg pl-3 pr-8 py-2 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-neutral-400"
                          />
                          <button
                            onClick={() => {
                              if (subjectInputs[sem]?.trim()) {
                                addSubject(sem, subjectInputs[sem]);
                              }
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 mt-2 p-1 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {semesters.length === 0 && (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-neutral-200 rounded-2xl bg-neutral-50/50">
                    <BookOpen className="w-12 h-12 text-neutral-300 mb-3" />
                    <h3 className="text-lg font-semibold text-neutral-700 mb-1">No semesters found</h3>
                    <p className="text-sm text-neutral-500 max-w-sm">Get started by creating a new semester for this stream using the input field above.</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-20 border-2 border-dashed border-neutral-200 rounded-3xl bg-neutral-50">
              <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-sm">
                <Layers className="w-10 h-10 text-indigo-400" />
              </div>
              <h2 className="text-2xl font-bold text-neutral-800 mb-2">No Stream Selected</h2>
              <p className="text-neutral-500 max-w-md text-sm">
                Select a stream from the sidebar or create a new one to start managing the academic curriculum taxonomy.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
      </RoleProtectedRoute>
    );
}
