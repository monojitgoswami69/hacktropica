import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "bot";
  text: string;
  sources?: string[];
};

interface ChatAreaProps {
  messages: Message[];
  isStreaming?: boolean;
  userName?: string | null;
  userEmail?: string | null;
}

export default function ChatArea({ messages, isStreaming, userName, userEmail }: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const isNearBottom = () => {
    const container = scrollRef.current;
    if (!container) return true;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    return distanceFromBottom <= 120;
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    if (!isNearBottom()) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: isStreaming ? "auto" : "smooth",
      });
      rafRef.current = null;
    });

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    const firstName = userName ? userName.split(" ")[0] : "Student";
    return (
      <div className="flex-1 px-8 py-10 overflow-y-auto w-full space-y-8 pb-32 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center justify-center py-12 text-center max-w-5xl mx-auto w-full">
          <h2 className="text-3xl font-extrabold text-on-surface font-headline tracking-tight text-slate-800">
            How can I help you today, {firstName}?
          </h2>
          <p className="text-slate-500/70 text-sm mt-3 max-w-sm">
            Ask a question to start learning or clear your doubts!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={scrollRef}
      className="flex-1 px-4 md:px-8 py-6 overflow-y-auto overflow-x-hidden w-full mb-32 flex flex-col items-center font-chat"
    >
      <div className="w-full max-w-3xl flex flex-col">
      {messages.map((msg, idx) => {
        const isLastBot = msg.role === "bot" && idx === messages.length - 1;
        const isStreamingThis = isLastBot && isStreaming;
        const isEmpty = msg.role === "bot" && msg.text === "";
        const previousRole = idx > 0 ? messages[idx - 1].role : null;
        const sources = msg.sources || [];

        return (
          <div key={idx} className="flex flex-col w-full">
            <div className={`w-full flex items-start gap-4 md:gap-6 ${idx > 0 && msg.role === "user" ? "mt-8" : "mt-0"}`}>
              {/* Avatar */}
              {msg.role === "bot" ? (
                <div className="w-8 h-8 flex-shrink-0"></div>
              ) : (
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200 shadow-sm">
                  <img 
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail || userName || "default"}&backgroundColor=b6e3f4`}
                    alt="User"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                {msg.role === "bot" && idx > 0 && previousRole === "user" && (
                  <div className="w-full h-[2px] bg-slate-300/80 my-3" />
                )}
                {msg.role === "user" ? (
                  <div className="text-[15px] md:text-base leading-relaxed text-slate-800 whitespace-pre-wrap mt-1" style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                    {msg.text}
                  </div>
                ) : (
                  <div className={`text-[15px] md:text-base leading-relaxed text-[#23457a] w-full ${isStreamingThis ? "streaming-bubble" : ""}`}>
                    {isEmpty ? (
                      <div className="flex items-center gap-2 text-[#23457a]/50 mt-2">
                        <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-[#23457a]/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-[#23457a]/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-[#23457a]/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="prose prose-slate max-w-none 
                          prose-p:mt-1 prose-p:mb-2 prose-p:leading-relaxed prose-p:first:mt-1 prose-p:text-[#23457a]
                          prose-ul:my-3 prose-ol:my-3 prose-li:my-1.5 prose-li:text-[#23457a] prose-li:leading-relaxed
                          prose-headings:font-bold prose-headings:text-[#1e3a63] prose-headings:mt-6 prose-headings:mb-3 prose-headings:first:mt-1
                          prose-code:bg-slate-100/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[14px] prose-code:text-[#0d47a1] prose-code:before:content-none prose-code:after:content-none
                          prose-pre:bg-[#0f172a] prose-pre:text-slate-50 prose-pre:rounded-xl prose-pre:p-4 prose-pre:my-4 prose-pre:shadow-sm
                          prose-strong:text-[#193259] prose-strong:font-semibold
                          prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                          prose-hr:my-8 prose-hr:border-slate-300/70
                        " style={{ fontFamily: '"JetBrains Mono", monospace' }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.text}
                          </ReactMarkdown>
                          {isStreamingThis && (
                            <span className="inline-block w-2 h-4 bg-slate-400 ml-1 animate-pulse rounded-sm align-middle" />
                          )}
                        </div>

                        {/* Sources — from structured JSON, not parsed from text */}
                        {sources.length > 0 && !isStreamingThis && (
                          <div className="mt-4 pt-3 border-t border-slate-200/60">
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mb-1.5 uppercase tracking-wider">
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                              Sources
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {sources.map((src, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200/80"
                                >
                                  {src}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
