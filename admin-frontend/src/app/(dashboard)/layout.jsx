"use client";
import React, { useState } from 'react';
import { Sidebar } from '../../components/AppShell/Sidebar';
import { Menu } from 'lucide-react';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function DashboardLayout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="h-screen w-full bg-neutral-50 text-neutral-900 overflow-hidden" style={{ height: '100dvh' }}>
        <a href="#main-content" className="skip-to-content sr-only focus:not-sr-only">
          Skip to content
        </a>

        <Sidebar isMobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

        <div className="lg:ml-60 h-full flex flex-col min-w-0 max-w-full overflow-hidden">
          
          {/* Mobile Header with Hamburger Menu */}
          <div className="lg:hidden flex mb-0 items-center gap-2 sm:gap-3 flex-shrink-0 bg-white p-3 border-b border-neutral-200 sticky top-0 z-20">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors shadow-sm flex-shrink-0 touch-target flex items-center justify-center min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px]"
              aria-label="Toggle navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-neutral-900 truncate flex-1">
              Vidyarthi Sarthi
            </h1>
          </div>

          <main id="main-content" className="w-full flex-[1_1_0%] p-4 md:p-6 lg:p-8 min-h-0 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
