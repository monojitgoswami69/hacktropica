"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import RoleProtectedRoute from '../../../components/RoleProtectedRoute';
import { motion } from 'framer-motion';
import api from '../../../services/api';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function StreamAnalytics() {
  const [selectedSemester, setSelectedSemester] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [curriculum, setCurriculum] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch curriculum to populate semester dropdown
  useEffect(() => {
    api.filters.getFilters().then(data => {
      const curricData = data.curriculum || {};
      setCurriculum(curricData);
      // Get the stream's semester keys (they come from the backend scoped by stream)
      const allSemesters = new Set();
      Object.values(curricData).forEach(streamData => {
        Object.keys(streamData).forEach(sem => allSemesters.add(sem));
      });
      const semList = Array.from(allSemesters).sort();
      if (semList.length > 0 && !selectedSemester) {
        setSelectedSemester(semList[0]);
      }
    }).catch(() => {});
  }, []);

  // Fetch analytics when semester changes
  useEffect(() => {
    if (!selectedSemester) return;
    setLoading(true);
    setError(null);
    api.analytics.stream(selectedSemester)
      .then(data => {
        setAnalyticsData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch analytics');
        setLoading(false);
      });
  }, [selectedSemester]);

  // Derive semester list from curriculum
  const allSemesters = new Set();
  Object.values(curriculum).forEach(streamData => {
    if (typeof streamData === 'object') {
      Object.keys(streamData).forEach(sem => allSemesters.add(sem));
    }
  });
  const semesterList = Array.from(allSemesters).sort();

  const subjects = analyticsData?.subjects || [];
  const netScore = analyticsData?.net_score || 0;
  const totalStudents = analyticsData?.total_students || 0;
  const totalQueries = analyticsData?.total_queries || 0;
  const streamName = analyticsData?.stream || 'N/A';

  return (
    <RoleProtectedRoute routeName="stream-analytics">
      <motion.main 
        className="p-4 md:p-8 space-y-8 w-full font-['Space_Grotesk'] text-[#2c2f30]"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {/* Page Header */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-neutral-200 pb-6 w-full">
          <div>
            <span className="uppercase tracking-widest text-[12px] font-bold text-primary-600 mb-1 block">
              HOD Overview
            </span>
            <h2 className="text-3xl font-black tracking-tight text-neutral-900">Stream Analytics</h2>
            <p className="text-sm md:text-base text-neutral-500 mt-2 font-medium">
              Monitor subject-wise proficiency and query patterns for your stream.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">Stream:</span>
              <span className="text-xs font-bold bg-neutral-100 border border-neutral-200 rounded-lg py-2 px-4 text-neutral-700 uppercase">{streamName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">Students:</span>
              <span className="text-xs font-bold bg-primary-50 border border-primary-200 rounded-lg py-2 px-4 text-primary-700">{totalStudents}</span>
            </div>
          </div>
        </section>

        {/* Top Section: Subject Understanding Analysis & Net Score Circle */}
        <div className="bg-white rounded-xl p-6 md:p-8 border border-neutral-200 shadow-sm w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4 sm:gap-0 border-b border-neutral-100 pb-6">
            <h3 className="text-lg font-bold flex items-center gap-3 text-neutral-900">
              <span className="material-symbols-outlined text-primary-600 bg-primary-50 p-2 rounded-lg">monitoring</span>
              Subject Understanding Analysis
            </h3>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">Semester:</span>
              <select 
                className="text-sm font-bold bg-neutral-50 border border-neutral-200 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer w-full sm:w-auto text-neutral-800"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
              >
                {semesterList.map(sem => (
                  <option key={sem} value={sem}>{sem.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                <span className="text-sm font-medium text-neutral-400">Loading analytics...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-red-300 mb-2">error</span>
                <p className="text-sm text-red-500 font-medium">{error}</p>
              </div>
            </div>
          ) : subjects.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">analytics</span>
                <p className="text-sm text-neutral-400 font-medium">No analytics data available for this semester yet.</p>
                <p className="text-xs text-neutral-300 mt-1">Students need to make queries to generate proficiency data.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
              {/* Left: Progress Bars */}
              <div className="flex-1 w-full space-y-8">
                {subjects.map((item, idx) => (
                  <Link href={`/stream-analytics/${encodeURIComponent(item.subject)}?sem=${encodeURIComponent(selectedSemester)}`} key={idx} className="block space-y-3 cursor-pointer group">
                    <div className="flex justify-between text-xs font-bold text-neutral-600 uppercase tracking-widest group-hover:text-primary-600 transition-colors">
                      <span className="flex items-center gap-2">
                         {item.subject}
                         <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-100 transition-opacity">arrow_forward</span>
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-neutral-400 normal-case tracking-normal">{item.total_queries} queries</span>
                        <span className="text-primary-600 text-sm group-hover:text-primary-700">{item.proficiency_score}%</span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-neutral-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${item.proficiency_score < 70 ? 'bg-amber-400' : item.proficiency_score < 80 ? 'bg-primary-400' : 'bg-primary-600'}`} 
                        style={{ width: `${item.proficiency_score}%` }}
                      ></div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Right: Circular Graph */}
              <div className="relative shrink-0 flex items-center justify-center p-4 lg:p-8">
                <div className="relative w-56 h-56 flex items-center justify-center">
                  {/* Background Track */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle 
                      cx="50" cy="50" r="44" 
                      fill="transparent" 
                      stroke="currentColor" 
                      strokeWidth="8" 
                      className="text-neutral-100" 
                    />
                    {/* Progress Arc: r=44 means circumference = 2 * PI * 44 = 276.46 */}
                    <circle 
                      cx="50" cy="50" r="44" 
                      fill="transparent" 
                      stroke="currentColor" 
                      strokeWidth="8" 
                      strokeLinecap="round"
                      strokeDasharray="276.46" 
                      strokeDashoffset={276.46 - (netScore / 100) * 276.46}
                      className="text-primary-600 transition-all duration-1000 ease-out" 
                    />
                  </svg>
                  {/* Center Content */}
                  <div className="relative z-10 text-center flex flex-col items-center justify-center">
                    <span className="text-6xl font-black text-neutral-900 tracking-tighter" style={{ lineHeight: '1.1' }}>{netScore}</span>
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest mt-1">Avg Score</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Section: Query Stats Summary */}
        {analyticsData && !loading && (
          <div className="w-full mt-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 border border-neutral-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-primary-600 bg-primary-50 p-2 rounded-lg text-xl">query_stats</span>
                  <span className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Total Queries</span>
                </div>
                <p className="text-4xl font-black text-neutral-900">{totalQueries.toLocaleString()}</p>
                <p className="text-xs text-neutral-400 mt-2">Across all subjects in {selectedSemester.toUpperCase()}</p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-neutral-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-indigo-600 bg-indigo-50 p-2 rounded-lg text-xl">school</span>
                  <span className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Students</span>
                </div>
                <p className="text-4xl font-black text-neutral-900">{totalStudents}</p>
                <p className="text-xs text-neutral-400 mt-2">Enrolled in the {streamName.toUpperCase()} stream</p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-neutral-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <span className="material-symbols-outlined text-emerald-600 bg-emerald-50 p-2 rounded-lg text-xl">trending_up</span>
                  <span className="text-sm font-bold text-neutral-500 uppercase tracking-wider">Net Proficiency</span>
                </div>
                <p className={`text-4xl font-black ${netScore >= 75 ? 'text-emerald-600' : netScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{netScore}%</p>
                <p className="text-xs text-neutral-400 mt-2">Average across {subjects.length} subjects</p>
              </div>
            </div>
          </div>
        )}

      </motion.main>
    </RoleProtectedRoute>
  );
}
