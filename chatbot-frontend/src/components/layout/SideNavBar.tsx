import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchProfile, type UserProfile, onAuthChange } from "@/lib/auth";
import { useChat } from "@/context/ChatContext";

interface SideNavBarProps {
  userEmail?: string;
  userDisplayName?: string | null;
}

export default function SideNavBar({
  userEmail,
  userDisplayName,
}: SideNavBarProps) {
  const navigate = useNavigate();
  const {
    chats,
    currentChatId,
    handleNewChat,
    handleSelectChat,
    initializeChats,
    handlePinChat,
    handleShareChat,
    handleDeleteChat,
  } = useChat();
  const [recentChatsOpen, setRecentChatsOpen] = useState(true);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [activeMenuChatId, setActiveMenuChatId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Try to load profile from cache first
    const cachedProfile = localStorage.getItem('cached_profile');
    if (cachedProfile) {
      try {
        setProfileData(JSON.parse(cachedProfile));
      } catch {
        // ignore
      }
    }

    fetchProfile().then((data) => {
      const finalData = data || { semester: 'NA', stream: 'NA', batch: 'NA', rollNumber: 'NA' };
      setProfileData(finalData);
      localStorage.setItem('cached_profile', JSON.stringify(finalData));
    }).catch(() => {
      if (!cachedProfile) {
        setProfileData({ semester: 'NA', stream: 'NA', batch: 'NA', rollNumber: 'NA' });
      }
    });
  }, []);

  useEffect(() => {
    const unsub = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        initializeChats(firebaseUser.uid);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuChatId(null);
      }
    };
    if (activeMenuChatId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeMenuChatId]);

  const handleNewChatClick = () => {
    handleNewChat();
    navigate("/chat");
  };

  const handleSelectChatClick = (id: string) => {
    handleSelectChat(id);
    navigate("/chat");
  };

  const handlePinClick = (chatId: string) => {
    handlePinChat(chatId);
    setActiveMenuChatId(null);
  };

  const handleShareClick = async (chatId: string) => {
    const copied = await handleShareChat(chatId);
    if (!copied) {
      window.alert("Could not copy. Please try again.");
    }
    setActiveMenuChatId(null);
  };

  const handleDeleteClick = (chatId: string) => {
    handleDeleteChat(chatId);
    setActiveMenuChatId(null);
  };

  const displayName = userDisplayName || userEmail?.split("@")[0] || "Student";
  const avatarSeed = userEmail || "default";

  return (
    <aside className="w-[280px] flex-shrink-0 h-full flex flex-col pt-10 pb-6 px-2 z-50 bg-white font-body text-sm font-medium">
      <div className="flex flex-col items-center mb-4">
        <div className="relative w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center mb-2">
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}&backgroundColor=b6e3f4`}
            alt="Profile"
            className="object-cover rounded-full w-full h-full"
          />
        </div>
        <h2 className="text-[1rem] font-bold text-slate-600 mt-0.5">{displayName}</h2>
        <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5 max-w-[200px] truncate">
          {profileData ? `Sem: ${profileData.semester} • ${profileData.stream}` : "Fetching Details..."}
        </p>
      </div>

      {/* Primary CTA */}
      <div className="px-5 mb-3">
        <button
          onClick={handleNewChatClick}
          className="flex items-center justify-center gap-2 w-full bg-slate-800 text-white py-2 rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95 cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span className="text-sm">New Chat</span>
        </button>
      </div>

      {/* Navigation Scrollable Area */}
      <nav className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-3 px-3 scrollbar-hide">
          {/* Recent Chats Section */}
          <div className="mt-0">
            <button
              onClick={() => setRecentChatsOpen(!recentChatsOpen)}
              className="relative flex items-center justify-center w-full px-4 py-2 text-slate-500 text-xs font-semibold uppercase tracking-wider transition-all group cursor-pointer hover:text-slate-700 hover:bg-slate-50/30 rounded-lg"
            >
              <span>Recent chats</span>
              <span
                className={`material-symbols-outlined text-[16px] absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity ${recentChatsOpen ? "rotate-180" : ""}`}
              >
                expand_more
              </span>
            </button>

            {recentChatsOpen && (
              <div className="space-y-0.5 mt-1">
                {chats && chats.length > 0 ? (
                  chats.map((chat) => (
                    <div
                      key={chat.id}
                      className="relative group flex items-center w-full rounded-xl"
                    >
                      <button
                        onClick={() => handleSelectChatClick(chat.id)}
                        className={`flex items-center w-full pl-4 pr-16 py-1.5 rounded-xl transition-all hover:translate-x-1 duration-200 ${
                          currentChatId === chat.id
                            ? "bg-blue-100/30 text-slate-700 font-semibold"
                            : "text-slate-400 hover:bg-slate-100/50 hover:text-slate-600"
                        }`}
                      >
                        <span className="text-sm truncate whitespace-nowrap flex-1 text-left">
                          {chat.name}
                        </span>
                      </button>

                      {chat.pinned && (
                        <span
                          className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 rotate-45 text-slate-400 leading-none transition-transform duration-200 group-hover:-translate-x-7"
                          style={{ fontSize: "10px", fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}
                        >
                          push_pin
                        </span>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuChatId(activeMenuChatId === chat.id ? null : chat.id);
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <span className="material-symbols-outlined text-[18px]">more_horiz</span>
                      </button>

                      {activeMenuChatId === chat.id && (
                        <div
                          ref={menuRef}
                          className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-slate-200 z-50 w-40 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                        >
                          <button
                            onClick={() => handlePinClick(chat.id)}
                            className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-sm transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">push_pin</span>
                            <span>Pin</span>
                          </button>
                          <button
                            onClick={() => handleShareClick(chat.id)}
                            className="w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 text-sm transition-colors border-t border-slate-100"
                          >
                            <span className="material-symbols-outlined text-[16px]">share</span>
                            <span>Share</span>
                          </button>
                          <button
                            onClick={() => handleDeleteClick(chat.id)}
                            className="w-full px-3 py-2 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 text-sm transition-colors border-t border-slate-100"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2 text-xs text-slate-300 italic text-center">
                    No recent chats
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Study Resources */}
        <div className="px-3 py-3 space-y-3 border-t border-slate-100">
          <div className="px-4 py-2 text-slate-500 text-xs font-semibold uppercase tracking-wider text-center flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[16px]">
              menu_book
            </span>
            <span> Study Resources </span>
          </div>

          <div className="space-y-0.5">
            <Link
              to="/resources"
              className="flex items-center gap-3 px-4 py-1.5 text-slate-400 rounded-xl transition-all hover:bg-slate-100/50 hover:text-slate-600 hover:translate-x-1 duration-200"
            >
              <span className="material-symbols-outlined text-[20px]">
                library_books
              </span>
              <span className="text-sm font-medium">Study Materials</span>
            </Link>
            <Link
              to="/exam"
              className="flex items-center gap-3 px-4 py-1.5 text-slate-400 rounded-xl transition-all hover:bg-slate-100/50 hover:text-slate-600 hover:translate-x-1 duration-200"
            >
              <span className="material-symbols-outlined text-[20px]">
                quiz
              </span>
              <span className="text-sm font-medium">Exam Preparation</span>
            </Link>
          </div>
        </div>
      </nav>


    </aside>
  );
}
