import React, { useEffect, useState } from "react";
import ChatArea from "@/components/chat/ChatArea";
import ChatInput from "@/components/chat/ChatInput";
import { useChat } from "@/context/ChatContext";
import { auth, type User } from "@/lib/auth";
import { useLocation } from "react-router-dom";

export default function ChatPage() {
  const { chats, currentChatId, isStreaming, handleSendMessage } = useChat();
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const location = useLocation();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return unsub;
  }, []);

  const currentChat = chats.find((c) => c.id === currentChatId);
  const currentMessages = currentChat?.messages || [];

  const document_id = new URLSearchParams(location.search).get("document_id");

  return (
    <div className="flex flex-col h-full absolute inset-0">
      <ChatArea 
        messages={currentMessages} 
        isStreaming={isStreaming} 
        userName={user?.displayName || user?.email?.split('@')[0]}
        userEmail={user?.email || undefined} 
      />
      <ChatInput 
        onSendMessage={(text) => handleSendMessage(text, user, document_id ? { document_id } : undefined)} 
        isStreaming={isStreaming} 
      />
    </div>
  );
}
