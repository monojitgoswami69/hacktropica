"use client";

import React, { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import RoleProtectedRoute from '../../../../components/RoleProtectedRoute';
import api from '../../../../services/api';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function SubjectAnalyticsPage({ params }) {
  const resolvedParams = use(params);
  const subjectName = decodeURIComponent(resolvedParams.subject);
  const searchParams = useSearchParams();
  const router = useRouter();
  const semester = searchParams.get('sem') || 'sem 1';

  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api.analytics.subject(subjectName, semester)
      .then(data => {
        setAnalyticsData(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || 'Failed to fetch subject analytics');
        setLoading(false);
      });
  }, [subjectName, semester]);

  const modules = analyticsData?.modules || [];
  const students = analyticsData?.students || [];
  const totalQueries = analyticsData?.total_queries || 0;
  const maxQueries = modules.length > 0 ? Math.max(...modules.map(d => d.query_count), 1) : 1;

  // Determine heatmap color based on intensity
  const getHeatmapStyle = (count) => {
    const ratio = count / maxQueries;
    if (ratio > 0.8) return "bg-red-500 text-white border-red-600";
    if (ratio > 0.6) return "bg-red-400 text-white border-red-500";
    if (ratio > 0.4) return "bg-red-300 text-red-950 border-red-400";
    if (ratio > 0.2) return "bg-red-200 text-red-950 border-red-300";
    return "bg-red-50 text-red-900 border-red-100";
  };

  return (
    <RoleProtectedRoute routeName="stream-analytics">
      <motion.main 
        className="p-4 md:p-8 space-y-8 w-full font-['Space_Grotesk'] text-[#2c2f30]"
        variants={pageVariants}
        initial="initial"
        animate="animate"
      >
        {/* Page Header */}
        <section className="flex flex-col gap-4 border-b border-neutral-200 pb-6 w-full">
          <div>
            <Link href="/stream-analytics" className="inline-flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-primary-600 transition-colors mb-4">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Stream Analytics
            </Link>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              <div>
                <span className="uppercase tracking-widest text-[12px] font-bold text-primary-600 mb-1 block">
                  Subject Deep Dive
                </span>
                <h2 className="text-3xl font-black tracking-tight text-neutral-900">{subjectName}</h2>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">Semester:</span>
                  <span className="text-xs font-bold bg-neutral-100 border border-neutral-200 rounded-lg py-2 px-4 text-neutral-700 uppercase">
                    {semester}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-bold text-neutral-400 uppercase tracking-wider">Total Queries:</span>
                  <span className="text-xs font-bold bg-red-50 border border-red-200 rounded-lg py-2 px-4 text-red-700">
                    {totalQueries}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-neutral-400">Loading subject analytics...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <span className="material-symbols-outlined text-4xl text-red-300 mb-2">error</span>
              <p className="text-sm text-red-500 font-medium">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Heatmap Section */}
            <section className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 md:p-8">
              <div className="mb-6 border-b border-neutral-100 pb-6">
                <h3 className="text-lg font-bold flex items-center gap-3 text-neutral-900">
                  <span className="material-symbols-outlined text-red-600 bg-red-50 p-2 rounded-lg">local_fire_department</span>
                  Topic Query Heatmap
                </h3>
                <p className="text-sm text-neutral-500 mt-2 font-medium">Relative density of student queries across different documents and modules.</p>
              </div>
              
              {modules.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">grid_view</span>
                    <p className="text-sm text-neutral-400 font-medium">No module data available yet.</p>
                    <p className="text-xs text-neutral-300 mt-1">Upload documents for this subject and students will generate query data.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {modules.map((doc, idx) => {
                      const bgClass = getHeatmapStyle(doc.query_count);
                      return (
                        <div key={idx} className={`p-5 rounded-xl border ${bgClass} flex flex-col justify-between h-32 transition-transform hover:scale-[1.02] shadow-sm`}>
                          <h4 className="font-bold text-sm leading-tight line-clamp-2">{doc.title}</h4>
                          <div className="mt-4 flex items-end justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">Queries</span>
                            <span className="text-2xl font-black">{doc.query_count}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  <div className="mt-8 flex items-center justify-end gap-3 text-xs font-bold text-neutral-500">
                    <span>Low</span>
                    <div className="flex gap-1 h-3">
                      <div className="w-8 bg-red-50 rounded-sm"></div>
                      <div className="w-8 bg-red-200 rounded-sm"></div>
                      <div className="w-8 bg-red-300 rounded-sm"></div>
                      <div className="w-8 bg-red-400 rounded-sm"></div>
                      <div className="w-8 bg-red-500 rounded-sm"></div>
                    </div>
                    <span>High</span>
                  </div>
                </>
              )}
            </section>

            {/* Student Analysis Section */}
            <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
              <div className="p-6 md:p-8 border-b border-neutral-100 bg-neutral-50/50">
                <h3 className="text-lg font-bold flex items-center gap-3 text-neutral-900">
                  <span className="material-symbols-outlined text-indigo-600 bg-indigo-50 p-2 rounded-lg">psychology</span>
                  Student Activity Analysis
                </h3>
                <p className="text-xs text-neutral-500 mt-2 font-medium">Tracking students and their primary areas of confusion for {subjectName}</p>
              </div>
              
              {students.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-4xl text-neutral-300 mb-2">person_search</span>
                    <p className="text-sm text-neutral-400 font-medium">No student query data for this subject yet.</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50">
                        <th className="pb-3 pt-4 px-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap w-[25%]">Student Name</th>
                        <th className="pb-3 pt-4 px-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap w-[15%] text-center">Student Roll</th>
                        <th className="pb-3 pt-4 px-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap w-[20%] text-center">Number of Queries</th>
                        <th className="pb-3 pt-4 px-6 text-[10px] font-bold text-neutral-500 uppercase tracking-widest w-[40%] text-right">Top Confusion Modules</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 text-sm">
                      {students.map((student, idx) => (
                        <tr 
                          key={student.uid || idx} 
                          className="hover:bg-neutral-50 transition-colors"
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                {student.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                              </div>
                              <div className="font-bold text-neutral-900 whitespace-nowrap">{student.name}</div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <div className="text-xs font-bold text-neutral-500 tracking-wider font-mono">{student.roll}</div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-center">
                              <span className="font-black text-lg text-neutral-800">{student.total_queries}</span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="text-[13px] font-medium text-neutral-700">
                              {student.top_modules && student.top_modules.length > 0
                                ? student.top_modules.slice(0, 2).join(', ')
                                : '—'
                              }
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

      </motion.main>
    </RoleProtectedRoute>
  );
}