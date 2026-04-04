"use client";

import React, { use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import RoleProtectedRoute from '../../../../../components/RoleProtectedRoute';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

// Mock Data
const studentNames = {
  "S001": "Aarav Sharma",
  "S002": "Priya Patel",
  "S003": "Rohan Gupta",
  "S004": "Neha Singh",
  "S005": "Aditya Kumar",
  "S006": "Sneha Reddy",
  "S007": "Kiran Desai",
};

const mockDocuments = [
  { id: 1, name: "Module 1: Introduction", totalAvailable: 120 },
  { id: 2, name: "Module 2: Core Concepts", totalAvailable: 45 },
  { id: 3, name: "Module 3: Advanced Topics", totalAvailable: 250 },
  { id: 4, name: "Case Study & Analysis", totalAvailable: 12 },
  { id: 5, name: "Previous Year Questions", totalAvailable: 380 },
  { id: 6, name: "Assignment Guidelines", totalAvailable: 80 },
  { id: 7, name: "Module 4: Applications", totalAvailable: 200 },
  { id: 8, name: "Lab Manual", totalAvailable: 150 },
  { id: 9, name: "Important Definitions", totalAvailable: 65 },
  { id: 10, name: "Summary Notes", totalAvailable: 30 },
];

export default function StudentAnalysisPage({ params }) {
  // Unwrap params using React.use for Next.js ^15
  const resolvedParams = use(params);
  const subjectName = decodeURIComponent(resolvedParams.subject);
  const studentId = decodeURIComponent(resolvedParams.studentId);
  const searchParams = useSearchParams();
  const semester = searchParams.get('sem') || 'sem 1';

  const studentName = studentNames[studentId] || "Unknown Student";

  // Generate deterministic mock query counts based on studentId for the documents
  const generateStudentQueries = (docId) => {
    // arbitrary math just to give different numbers for different students
    const seed = parseInt(studentId.replace('S', '')) * docId;
    return (seed % 15) + (seed % 3 === 0 ? 10 : 0);
  };

  const studentData = mockDocuments.map(doc => ({
    ...doc,
    studentQueries: generateStudentQueries(doc.id)
  })).sort((a, b) => b.studentQueries - a.studentQueries);

  const totalStudentQueries = studentData.reduce((acc, curr) => acc + curr.studentQueries, 0);

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
            <Link href={`/stream-analytics/${encodeURIComponent(resolvedParams.subject)}?sem=${encodeURIComponent(semester)}`} className="inline-flex items-center gap-2 text-sm font-bold text-neutral-500 hover:text-primary-600 transition-colors mb-4">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to {subjectName} Analytics
            </Link>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mt-2">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl shrink-0 border-2 border-white shadow-sm ring-1 ring-neutral-200">
                  {studentName.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase()}
                </div>
                <div>
                  <span className="uppercase tracking-widest text-[12px] font-bold text-indigo-600 mb-1 block">
                    Student Deep Dive
                  </span>
                  <h2 className="text-3xl font-black tracking-tight text-neutral-900">{studentName}</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-sm font-bold text-neutral-500 font-mono tracking-wider">{studentId}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-300"></span>
                    <span className="text-sm font-semibold text-neutral-600">{subjectName}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-300"></span>
                    <span className="text-sm font-semibold text-neutral-600 uppercase">{semester}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Student Document Queries Overview */}
        <section className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden mt-6">
          <div className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-100 bg-neutral-50/50">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-3 text-neutral-900">
                <span className="material-symbols-outlined text-indigo-600 bg-indigo-50 p-2 rounded-lg">library_books</span>
                Document Query Analysis
              </h3>
              <p className="text-xs text-neutral-500 mt-2 font-medium">Breakdown of specific sections where the student requested help.</p>
            </div>
            <div className="bg-white px-5 py-3 rounded-xl border border-neutral-200 shadow-sm flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Total Queries</span>
              <span className="text-2xl font-black text-indigo-600 mt-1">{totalStudentQueries}</span>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 flex justify-between px-6 py-2.5">
                  <th className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Document / Module Name</th>
                  <th className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest whitespace-nowrap">Queries by Student</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-sm block">
                {studentData.map((doc) => (
                  <tr key={doc.id} className="hover:bg-neutral-50 transition-colors group flex justify-between items-center px-6 py-2">
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[18px] text-neutral-400 group-hover:text-indigo-500 transition-colors">description</span>
                        <span className="font-semibold text-neutral-800 text-[13px]">{doc.name}</span>
                      </div>
                    </td>
                    <td className="w-24 text-right pr-4">
                      <span className={`font-black text-base ${doc.studentQueries > 10 ? 'text-red-500' : doc.studentQueries > 0 ? 'text-indigo-600' : 'text-neutral-400'}`}>
                        {doc.studentQueries > 0 ? doc.studentQueries : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
                {studentData.length === 0 && (
                  <tr>
                    <td colSpan="2" className="py-4 text-center text-neutral-500 font-medium text-[13px]">
                      No query data available for this student.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </motion.main>
    </RoleProtectedRoute>
  );
}