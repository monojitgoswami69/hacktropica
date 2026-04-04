import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, loginWithGoogle, onAuthChange } from "@/lib/auth";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // If already logged in, redirect to /chat
  useEffect(() => {
    const unsub = onAuthChange((user) => {
      if (user) {
        navigate("/chat");
      } else {
        setCheckingAuth(false);
      }
    });
    return unsub;
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await loginUser(email, password);
      // onAuthChange will handle redirect
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      const cleaned = msg
        .replace("Firebase: ", "")
        .replace(/\(auth\/.*\)\.?/, "")
        .trim();
      setError(cleaned || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      const cleaned = msg.replace("Firebase: ", "").replace(/\(auth\/.*\)\.?/, "").trim();
      setError(cleaned || "Google sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-3 border-slate-200 border-t-[#0d47a1] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white relative font-body text-slate-800">
      {/* Top Navbar */}
      <nav className="absolute top-0 left-0 w-full flex justify-between items-center p-4 px-6 md:px-10 z-50">
        <div className="flex items-center gap-2 text-slate-600 transition-colors">
          <span className="material-symbols-outlined text-xl">school</span>
          <span className="font-medium text-lg tracking-tight">Vidyarthi Saarthi</span>
        </div>
      </nav>

      {/* Left Section - Hero */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 pt-24 pb-12 w-full lg:max-w-[calc(100%-480px)] xl:max-w-[calc(100%-520px)]">
        <div className="max-w-3xl">
          <h1 className="text-5xl lg:text-[4rem] font-medium leading-[1.1] tracking-tight text-slate-800 mb-6 font-headline">
            Learn with <span className="text-[#1a559e] font-semibold">AI Precision</span>,<br/>
            Master with <span className="text-[#328549] italic font-semibold border-b-4 border-[#328549]/30">Understanding.</span>
          </h1>
          
          <p className="text-slate-500 text-lg md:text-xl max-w-2xl leading-relaxed mb-16">
            Empowering your educational journey through Socratic AI coaching, retrieval-augmented accuracy, and deep conceptual comprehension.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <h3 className="font-semibold text-slate-800 mb-2">Socratic AI Tutor</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Active questioning to ensure deep, fundamental understanding of concepts, not just memory.
              </p>
            </div>
            <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <h3 className="font-semibold text-slate-800 mb-2">Focused Context</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Receive answers explicitly grounded in your specific university syllabus and study materials.
              </p>
            </div>
            <div className="p-6 rounded-2xl border border-slate-100 bg-white shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
              <h3 className="font-semibold text-slate-800 mb-2">Interactive Learning</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Unlock daily achievements, track your knowledge curve, and engage naturally with your study bot.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Section - Login Form */}
      <div className="w-full md:absolute md:right-0 md:top-0 md:h-full md:w-[480px] xl:w-[520px] bg-[#e6ecef] flex flex-col justify-center items-center p-6 lg:p-12 min-h-screen md:min-h-0">
        
        <div className="w-full max-w-[420px] bg-white rounded-[2rem] p-8 lg:p-10 shadow-xl shadow-slate-200/50">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-1 font-headline">Welcome Back</h2>
            <p className="text-slate-500 text-sm">Sign in to continue your learning journey</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl p-3 mb-5 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-500 font-medium ml-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email" 
                required
                className="w-full bg-[#f3f6f8] text-sm text-slate-800 px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a559e]/20 transition-all font-medium placeholder:font-normal placeholder:text-slate-400"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs text-slate-500 font-medium">Password</label>
                <a href="#" className="text-xs text-[#1a559e] font-bold hover:underline">Forgot?</a>
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                required
                minLength={6}
                className="w-full bg-[#f3f6f8] text-sm text-slate-800 px-4 py-3.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a559e]/20 transition-all font-medium placeholder:font-normal placeholder:text-slate-400 tracking-widest"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0d47a1] hover:bg-[#1565c0] disabled:bg-slate-300 text-white font-bold text-sm tracking-widest uppercase py-4 rounded-xl transition-colors shadow-lg shadow-blue-900/20 text-center flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  SIGNING IN...
                </span>
              ) : (
                "SIGN IN"
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-1 opacity-60">
              <div className="flex-1 h-px bg-slate-300"></div>
              <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">OR CONNECT VIA</span>
              <div className="flex-1 h-px bg-slate-300"></div>
            </div>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full bg-[#f1f5f9] hover:bg-[#e2e8f0] disabled:opacity-50 text-slate-600 font-bold text-[11px] tracking-widest uppercase py-4 rounded-xl transition-colors flex items-center justify-center gap-3 cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              CONTINUE WITH GOOGLE
            </button>

            {/* Access notice */}
            <div className="bg-[#f8fafc] border border-slate-100 rounded-xl p-3 flex items-center justify-center gap-2 text-xs text-slate-500 mt-1">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              Access is restricted to registered students only.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
