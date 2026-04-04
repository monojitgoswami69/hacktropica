import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthChange, logoutUser } from "@/lib/auth";
import { auth, type User } from "@/lib/auth";
import SideNavBar from "@/components/layout/SideNavBar";
import TopAppBar from "@/components/layout/TopAppBar";
import { ChatProvider } from "@/context/ChatContext";
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [loading, setAuthLoading] = useState(() => !auth.currentUser);

  useEffect(() => {
    const unsub = onAuthChange((firebaseUser) => {
      if (!firebaseUser) {
        navigate("/");
        return;
      }
      setUser(firebaseUser);
      setAuthLoading(false);
    });
    return unsub;
  }, [navigate]);

  const handleLogout = async () => {
    await logoutUser();
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f1f5f9]">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-[#0d47a1] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ChatProvider>
      <div className="flex h-screen w-screen bg-white">
        <SideNavBar
          userEmail={user?.email || undefined}
          userDisplayName={user?.displayName}
        />
        <main className="flex-1 flex flex-col relative overflow-hidden h-[calc(100vh-2rem)] my-4 mr-4 bg-[#f1f5f9] rounded-[2rem] shadow-sm">
          <TopAppBar
            userDisplayName={user?.displayName}
            userEmail={user?.email || undefined}
            onLogout={handleLogout}
          />
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <Outlet />
          </div>
        </main>
      </div>
    </ChatProvider>
  );
}
