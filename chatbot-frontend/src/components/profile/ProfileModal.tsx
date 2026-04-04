import { useState, useEffect } from "react";
import { fetchProfile, type UserProfile } from "@/lib/auth";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userDisplayName: string | null;
  userEmail: string;
}

export default function ProfileModal({ isOpen, onClose, userDisplayName, userEmail }: ProfileModalProps) {
  const [name, setName] = useState(userDisplayName || userEmail.split("@")[0] || "Student");
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchProfile()
        .then((data) => {
          setProfileData(data || { semester: 'NA', stream: 'NA', batch: 'NA', rollNumber: 'NA' });
        })
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      // You can also add backend call to updateProfileName from auth.ts
      const { updateProfileName } = await import("@/lib/auth");
      const success = await updateProfileName(name);
      if (success) {
        onClose(); // Optional: show a toast here instead
        // Force a reload of the UI later or trigger context update if u use global context
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 font-body relative">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold font-headline text-slate-800">Student Profile</h2>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 space-y-6">
          
          {/* Avatar Section (Editable) */}
          <div className="flex flex-col items-center">
            <div className="relative group w-24 h-24 mb-3">
              <div className="w-full h-full rounded-full overflow-hidden border-4 border-[#f1f5f9] relative">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail || "default"}&backgroundColor=b6e3f4`}
                  alt="Profile"
                  className="object-cover w-full h-full"
                />
                
                {/* Edit Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="material-symbols-outlined text-white">edit</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium">Click image to change (UI only)</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            
            {/* Name (Editable) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-200 text-slate-800 px-4 py-3 rounded-xl focus:border-[#1a559e] focus:ring-1 focus:ring-[#1a559e] transition-all font-medium text-sm outline-none"
                />
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">edit</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Roll Number (Read-only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Roll Record</label>
                <div className="w-full bg-slate-50 border border-slate-100 text-slate-600 px-4 py-3 rounded-xl font-medium text-sm cursor-not-allowed opacity-80 flex items-center justify-between">
                  {isLoading ? <span className="animate-pulse bg-slate-200 h-4 w-16 rounded"></span> : profileData?.rollNumber || "Unassigned"}
                  <span className="material-symbols-outlined text-[16px] text-slate-400">lock</span>
                </div>
              </div>

              {/* Semester (Read-only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Semester</label>
                <div className="w-full bg-slate-50 border border-slate-100 text-slate-600 px-4 py-3 rounded-xl font-medium text-sm cursor-not-allowed opacity-80 flex items-center justify-between">
                  {isLoading ? <span className="animate-pulse bg-slate-200 h-4 w-16 rounded"></span> : profileData?.semester || "Unassigned"}
                  <span className="material-symbols-outlined text-[16px] text-slate-400">lock</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Stream (Read-only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Stream</label>
                <div className="w-full bg-slate-50 border border-slate-100 text-slate-600 px-4 py-3 rounded-xl font-medium text-sm cursor-not-allowed opacity-80 flex items-center justify-between">
                  {isLoading ? <span className="animate-pulse bg-slate-200 h-4 w-24 rounded"></span> : profileData?.stream || "Unassigned"}
                  <span className="material-symbols-outlined text-[16px] text-slate-400">lock</span>
                </div>
              </div>

              {/* Batch (Read-only) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Batch</label>
                <div className="w-full bg-slate-50 border border-slate-100 text-slate-600 px-4 py-3 rounded-xl font-medium text-sm cursor-not-allowed opacity-80 flex items-center justify-between">
                  {isLoading ? <span className="animate-pulse bg-slate-200 h-4 w-20 rounded"></span> : profileData?.batch || "Unassigned"}
                  <span className="material-symbols-outlined text-[16px] text-slate-400">lock</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-3xl">
          <button 
            onClick={onClose}
            disabled={isSaving}
            className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200/50 rounded-xl transition-colors cursor-pointer uppercase tracking-wider disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="px-6 py-2.5 text-sm font-bold bg-[#0d47a1] hover:bg-[#1565c0] text-white rounded-xl transition-colors shadow-md shadow-blue-900/20 cursor-pointer uppercase tracking-wider flex items-center justify-center min-w-[140px] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <span className="material-symbols-outlined animate-spin text-lg">sync</span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
