'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, Users, AlertCircle, Filter, ChevronDown } from 'lucide-react';
import RoleProtectedRoute from '../../../components/RoleProtectedRoute';
import api from '../../../services/api';

export default function StudentRecords() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStream, setFilterStream] = useState('All');
  const [filterSem, setFilterSem] = useState('All');

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const data = await api.admin.students();
        setStudents(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch student records.');
        console.error('Error fetching students:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const streams = useMemo(() => {
    const s = new Set(students.map(st => st.stream).filter(Boolean));
    return ['All', ...Array.from(s).sort()];
  }, [students]);

  const semesters = useMemo(() => {
    const s = new Set(students.map(st => st.sem).filter(Boolean));
    return ['All', ...Array.from(s).sort((a,b) => Number(a)-Number(b))];
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchSearch = student.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          student.roll?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          student.email?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStream = filterStream === 'All' || student.stream === filterStream;
      const matchSem = filterSem === 'All' || student.sem === filterSem;
      return matchSearch && matchStream && matchSem;
    });
  }, [students, searchTerm, filterStream, filterSem]);

  if (loading) {
    return (
      <RoleProtectedRoute requiredRoles={['admin', 'superuser']} routeName="student-records">
        <div className="flex items-center justify-center min-h-[500px]">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </RoleProtectedRoute>
    );
  }

  return (
    <RoleProtectedRoute requiredRoles={['admin', 'superuser']} routeName="student-records">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden"
        >
          <div className="p-6 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Student Records</h1>
                <p className="text-sm text-neutral-500">Manage and view enrolled student details.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by name, roll, email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full md:w-64 transition-all"
                />
              </div>
              
              <div className="flex gap-2">
                <select
                  value={filterStream}
                  onChange={(e) => setFilterStream(e.target.value)}
                  className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-neutral-700 font-medium"
                >
                  <option value="All">All Streams</option>
                  {streams.filter(s => s !== 'All').map(stream => (
                    <option key={stream} value={stream}>{stream}</option>
                  ))}
                </select>

                <select
                  value={filterSem}
                  onChange={(e) => setFilterSem(e.target.value)}
                  className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-neutral-700 font-medium"
                >
                  <option value="All">All Sems</option>
                  {semesters.filter(s => s !== 'All').map(sem => (
                    <option key={sem} value={sem}>Sem {sem}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-0">
            {error ? (
              <div className="p-8 text-center bg-red-50 text-red-600 rounded-xl m-6 border border-red-100">
                <AlertCircle className="w-8 h-8 mx-auto mb-3" />
                <p>{error}</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-16 bg-neutral-50/50">
                <div className="bg-white w-16 h-16 rounded-full flex items-center justify-center shadow-sm mx-auto mb-4 border border-neutral-100">
                  <Users className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="text-lg font-medium text-neutral-900 mb-1">No students found</h3>
                <p className="text-sm text-neutral-500">Adjust your filters or enroll new students to see them here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 sticky top-0">
                    <tr>
                      <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Name</th>
                      <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Roll No</th>
                      <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Stream</th>
                      <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Semester</th>
                      <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredStudents.map((student, idx) => (
                      <motion.tr 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        key={student.uid || student.roll || idx} 
                        className="hover:bg-neutral-50/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-neutral-900">{student.name || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md inline-block border border-indigo-100/50">
                            {student.roll || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-neutral-600">
                          {student.stream || 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100/50 px-2.5 py-1 rounded-full text-xs font-semibold">
                            Sem {student.sem || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-neutral-500">
                          {student.email || 'N/A'}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </RoleProtectedRoute>
  );
}
