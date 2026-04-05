"use client";

import React, { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import {
  fetchSessions, fetchSessionMessages, createSession,
  streamQueryUrl, getIdToken, auth,
  type ChatSession, type User,
} from "@/lib/auth";

export interface Message {
  role: "user" | "bot";
  text: string;
  sources?: string[];
}

export interface Chat {
  id: string;
  name: string;
  messages: Message[];
  sessionId?: string;
  pinned?: boolean;
}

interface ChatContextType {
  chats: Chat[];
  currentChatId: string | null;
  isStreaming: boolean;
  handleNewChat: () => void;
  handleSelectChat: (id: string) => Promise<void>;
  handleSendMessage: (text: string, user: User | null, additionalFilters?: { document_id?: string; subject?: string }) => Promise<void>;
  initializeChats: (userUid: string) => void;
  abortStream: () => void;
  handlePinChat: (id: string) => void;
  handleDeleteChat: (id: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sortChatsByPinned = (list: Chat[]) => {
    return [...list].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)));
  };

  const persistSessionsCache = (chatList: Chat[]) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    localStorage.setItem(
      `cached_sessions_${uid}`,
      JSON.stringify(chatList.map((c) => ({ id: c.sessionId || c.id, name: c.name, pinned: Boolean(c.pinned) })))
    );
  };

  const initializeChats = (userUid: string) => {
    const cachedSessions = localStorage.getItem(`cached_sessions_${userUid}`);
    if (cachedSessions) {
      try {
        const parsed = JSON.parse(cachedSessions);
        const loadedInitial = parsed.map((s: { id: string; name: string; pinned?: boolean }) => ({
          id: s.id,
          name: s.name,
          messages: [],
          sessionId: s.id,
          pinned: Boolean(s.pinned),
        }));
        setChats(sortChatsByPinned(loadedInitial));
      } catch {
        // ignore
      }
    }

    fetchSessions()
      .then((sessions: ChatSession[]) => {
        if (sessions.length > 0) {
          const loadedChats: Chat[] = sessions.map((s) => ({
            id: s.session_id,
            name: s.title,
            messages: [],
            sessionId: s.session_id,
            pinned: false,
          }));
          
          setChats((prev) => {
            const newChats = [...loadedChats];
            prev.forEach(p => {
              const match = newChats.find(n => n.id === p.id);
              if (match && p.messages.length > 0) {
                match.messages = p.messages;
              }
            });
            return sortChatsByPinned(newChats);
          });

          localStorage.setItem(
            `cached_sessions_${userUid}`,
            JSON.stringify(loadedChats.map((c) => ({ id: c.id, name: c.name, pinned: Boolean(c.pinned) })))
          );
        }
      })
      .catch(() => console.warn("Could not load sessions"));
  };

  const handlePinChat = (id: string) => {
    setChats((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c));
      const sorted = sortChatsByPinned(updated);
      persistSessionsCache(sorted);
      return sorted;
    });
  };

  const handleDeleteChat = async (id: string) => {
    console.log("🗑️ Delete chat called for ID:", id);
    
    if (isStreaming && currentChatId === id && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }

    const targetChat = chats.find((c) => c.id === id);
    console.log("🔍 Target chat:", targetChat);
    
    // Delete from backend if it has a session ID
    if (targetChat?.sessionId) {
      console.log("📡 Calling backend to delete session:", targetChat.sessionId);
      try {
        const { deleteSession } = await import("@/lib/auth");
        const result = await deleteSession(targetChat.sessionId);
        console.log("✅ Backend delete result:", result);
      } catch (err) {
        console.error("❌ Failed to delete session from backend:", err);
      }
    } else {
      console.log("⚠️ No session ID, skipping backend delete");
    }

    setChats((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target?.sessionId) {
        localStorage.removeItem(`cached_messages_${target.sessionId}`);
      }
      const filtered = prev.filter((c) => c.id !== id);
      persistSessionsCache(filtered);
      return filtered;
    });

    setCurrentChatId((prev) => (prev === id ? null : prev));
    console.log("✅ Chat deleted from local state");
  };

  const handleNewChat = () => {
    if (isStreaming && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
    setCurrentChatId(null);
  };

  const handleSelectChat = async (id: string) => {
    if (isStreaming && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
    setCurrentChatId(id);

    setChats((currentChatsList) => {
      const chat = currentChatsList.find((c) => c.id === id);
      if (chat?.sessionId && chat.messages.length === 0) {
        const cachedMsgs = localStorage.getItem(`cached_messages_${chat.sessionId}`);
        if (cachedMsgs) {
          try {
            const parsedMsgs = JSON.parse(cachedMsgs);
            setChats((prev) => prev.map((c) => (c.id === id ? { ...c, messages: parsedMsgs } : c)));
          } catch { }
        }

        fetchSessionMessages(chat.sessionId).then((msgs) => {
          const formatted: Message[] = msgs.map((m) => ({
            role: m.role === "user" ? "user" : "bot",
            text: m.content,
          }));
          localStorage.setItem(`cached_messages_${chat.sessionId}`, JSON.stringify(formatted));
          setChats((prev) =>
            prev.map((c) => (c.id === id ? { ...c, messages: formatted } : c))
          );
        }).catch(() => console.warn("Could not load messages for session", chat?.sessionId));
      }
      return currentChatsList;
    });
  };

  const abortStream = () => {
    if (isStreaming && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
    }
  };

  const handleSendMessage = async (text: string, user: User | null, additionalFilters?: { document_id?: string; subject?: string }) => {
    if (isStreaming || !text.trim()) return;

    let targetChatId = currentChatId;
    let newChatsState = [...chats];

    // Resolve or create a backend session
    let sessionId: string | undefined;

    if (targetChatId) {
      const existingChat = newChatsState.find((c) => c.id === targetChatId);
      sessionId = existingChat?.sessionId;
    }

    if (!targetChatId) {
      // Create a new local chat, then a backend session
      targetChatId = Date.now().toString();
      const newChat: Chat = {
        id: targetChatId,
        name: text.slice(0, 40) + (text.length > 40 ? "..." : ""),
        messages: [],
        pinned: false,
      };
      newChatsState = [newChat, ...chats];
      setChats(newChatsState);
      setCurrentChatId(targetChatId);
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsStreaming(true);

    const targetChat = newChatsState.find((c) => c.id === targetChatId);
    if (!targetChat) return;

    const updatedMessages: Message[] = [...targetChat.messages, { role: "user", text }];
    setChats((prev) => prev.map((c) => c.id === targetChatId ? { ...c, messages: updatedMessages } : c));

    const historyPayload = updatedMessages.slice(0, -1).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));

    try {
      // Create backend session if we don't have one
      if (!sessionId) {
        try {
          const newSession = await createSession();
          sessionId = newSession.session_id;
          setChats((prev) => {
            const updatedChats = prev.map((c) =>
              c.id === targetChatId ? { ...c, sessionId, name: text.slice(0, 40) + (text.length > 40 ? "..." : "") } : c
            );
            if (user) {
              localStorage.setItem(
                `cached_sessions_${user.uid}`,
                JSON.stringify(updatedChats.map((c) => ({ id: c.sessionId || c.id, name: c.name, pinned: Boolean(c.pinned) })))
              );
            }
            return updatedChats;
          });
        } catch (err) {
          console.warn("Failed to create session, continuing without persistence:", err);
        }
      }

      // Add empty bot message placeholder
      setChats((prev) => prev.map((c) => c.id === targetChatId ? { ...c, messages: [...updatedMessages, { role: "bot", text: "" }] } : c));

      // Build query payload
      const queryPayload: Record<string, unknown> = {
        query: text,
        top_k: 5,
        history: historyPayload,
      };
      if (sessionId) queryPayload.session_id = sessionId;

      // Add filters if provided
      if (additionalFilters) {
        const filters: Record<string, string> = {};
        if (additionalFilters.document_id) filters.document_id = additionalFilters.document_id;
        if (additionalFilters.subject) filters.subject = additionalFilters.subject;
        if (Object.keys(filters).length > 0) queryPayload.filters = filters;
      }

      // Stream the response from the backend
      const token = await getIdToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(streamQueryUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(queryPayload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Server error ${response.status}: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No readable stream");

      const decoder = new TextDecoder();
      let botResponse = "";
      let botSources: string[] = [];
      let lineBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lineBuffer += decoder.decode(value, { stream: true });

        // Process complete NDJSON lines
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() || ""; // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "chunk" && event.text) {
              botResponse += event.text;
            } else if (event.type === "done" && event.sources) {
              botSources = event.sources;
            }
          } catch {
            // Not valid JSON — treat as raw text fallback
            botResponse += line;
          }
        }

        setChats((prev) => prev.map((c) => {
          if (c.id === targetChatId) {
            const newMsgs = [...c.messages];
            newMsgs[newMsgs.length - 1] = { role: "bot", text: botResponse, sources: botSources.length > 0 ? botSources : undefined };
            return { ...c, messages: newMsgs };
          }
          return c;
        }));
      }

      // Process any remaining buffer
      if (lineBuffer.trim()) {
        try {
          const event = JSON.parse(lineBuffer);
          if (event.type === "chunk" && event.text) {
            botResponse += event.text;
          } else if (event.type === "done" && event.sources) {
            botSources = event.sources;
          }
        } catch {
          botResponse += lineBuffer;
        }
      }

      // Final state update with sources
      setChats((prev) => prev.map((c) => {
        if (c.id === targetChatId) {
          const newMsgs = [...c.messages];
          newMsgs[newMsgs.length - 1] = { role: "bot", text: botResponse, sources: botSources.length > 0 ? botSources : undefined };
          
          // Update chat name if it's still the default truncated query and we have a session
          const updatedChat = { ...c, messages: newMsgs };
          if (sessionId && c.messages.length === 1) {
            // This was the first message, update the name to match what backend saved
            updatedChat.name = text.slice(0, 60);
          }
          
          return updatedChat;
        }
        return c;
      }));

      // Cache final messages
      const finalMsgs = [...updatedMessages, { role: "bot" as const, text: botResponse, sources: botSources.length > 0 ? botSources : undefined }];
      if (sessionId) {
        localStorage.setItem(`cached_messages_${sessionId}`, JSON.stringify(finalMsgs));
        
        // Update cached sessions with the new title
        if (user && targetChat && targetChat.messages.length === 0) {
          const updatedChatsList = chats.map(c => 
            c.id === targetChatId 
              ? { ...c, name: text.slice(0, 60), sessionId } 
              : c
          );
          localStorage.setItem(
            `cached_sessions_${user.uid}`,
            JSON.stringify(updatedChatsList.map((c) => ({ 
              id: c.sessionId || c.id, 
              name: c.name, 
              pinned: Boolean(c.pinned) 
            })))
          );
        }
      }

    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === "AbortError") {
        console.log("Stream aborted");
      } else {
        console.error("Stream error:", error);
        setChats((prev) => prev.map((c) => {
          if (c.id === targetChatId) {
            const newMsgs = [...c.messages];
            const lastMsg = newMsgs[newMsgs.length - 1];
            if (lastMsg?.role === "bot" && !lastMsg.text) {
              newMsgs[newMsgs.length - 1] = { role: "bot", text: "Error: Could not fetch response. " + (error.message || "") };
            } else if (lastMsg?.role === "bot") {
              newMsgs[newMsgs.length - 1] = { role: "bot", text: lastMsg.text + "\n\n(Connection error)" };
            } else {
              newMsgs.push({ role: "bot", text: "Error: Could not fetch response." });
            }
            return { ...c, messages: newMsgs };
          }
          return c;
        }));
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <ChatContext.Provider value={{
      chats,
      currentChatId,
      isStreaming,
      handleNewChat,
      handleSelectChat,
      handleSendMessage,
      initializeChats,
      abortStream,
      handlePinChat,
      handleDeleteChat,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
