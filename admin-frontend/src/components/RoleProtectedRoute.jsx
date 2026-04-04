"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

const ROLE_PERMISSIONS = {
  superuser: ['dashboard', 'knowledge-base', 'manage-curriculum', 'add-document', 'add-text', 'query-analytics', 'unsolved-queries', 'bot-settings', 'system-instructions', 'user-settings', 'subject-analysis', 'stream-analytics', 'enroll-students', 'student-records'],
  admin: ['dashboard', 'knowledge-base', 'manage-curriculum', 'add-document', 'add-text', 'unsolved-queries', 'bot-settings', 'system-instructions', 'user-settings', 'enroll-students', 'student-records'],
  hod: ['dashboard', 'knowledge-base', 'add-document', 'add-text', 'unsolved-queries', 'bot-settings', 'system-instructions', 'user-settings', 'stream-analytics'],
  faculty: ['dashboard', 'knowledge-base', 'add-document', 'add-text', 'query-analytics', 'unsolved-queries', 'bot-settings', 'system-instructions', 'user-settings', 'subject-analysis'],
  assistant: ['dashboard', 'knowledge-base', 'query-analytics', 'unsolved-queries', 'bot-settings', 'user-settings', 'subject-analysis'],
};

export function RoleProtectedRoute({ children, requiredRoles = [], routeName = '' }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
        return;
      }
      
      const userRole = user?.role || 'assistant';
      if (requiredRoles.length > 0 && !requiredRoles.includes(userRole)) {
        router.replace('/unauthorized');
        return;
      }
      
      if (routeName && ROLE_PERMISSIONS[userRole] && !ROLE_PERMISSIONS[userRole].includes(routeName)) {
        router.replace('/unauthorized');
        return;
      }
    }
  }, [isLoading, isAuthenticated, user, requiredRoles, routeName, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 animate-pulse mb-4">
            <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-neutral-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const userRole = user?.role || 'assistant';
  if ((requiredRoles.length > 0 && !requiredRoles.includes(userRole)) || (routeName && ROLE_PERMISSIONS[userRole] && !ROLE_PERMISSIONS[userRole].includes(routeName))) {
    return null; // Will redirect in useEffect
  }

  return children;
}

export default RoleProtectedRoute;
