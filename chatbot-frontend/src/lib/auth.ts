// ─── Types ───

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

export interface ChatSession {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

// ─── Mock Global State for Auth ───
let currentUser: User | null = null;
const authListeners: ((user: User | null) => void)[] = [];

function notifyAuthChange() {
  authListeners.forEach((fn) => fn(currentUser));
}

// Mock auth object
export const auth = {
  get currentUser() {
    return currentUser;
  },
  onAuthStateChanged: (callback: (user: User | null) => void) => {
    authListeners.push(callback);
    callback(currentUser);
    return () => {
      const idx = authListeners.indexOf(callback);
      if (idx > -1) authListeners.splice(idx, 1);
    };
  }
};

// ─── Auth Functions ───

function createMockUser(email: string, displayName?: string): User {
  return {
    uid: "mock-uid-" + Date.now().toString(),
    email,
    displayName: displayName || email.split("@")[0],
    getIdToken: async () => "mock-token",
  };
}

export async function loginUser(email: string, password?: string): Promise<User> {
  const user = createMockUser(email);
  currentUser = user;
  localStorage.setItem("mock_user", JSON.stringify(user));
  notifyAuthChange();
  return user;
}

export async function registerUser(
  email: string,
  password?: string,
  displayName?: string
): Promise<User> {
  const user = createMockUser(email, displayName);
  currentUser = user;
  localStorage.setItem("mock_user", JSON.stringify(user));
  notifyAuthChange();
  return user;
}

export async function loginWithGoogle(): Promise<User> {
  const user = createMockUser("student@example.com", "Student User");
  currentUser = user;
  localStorage.setItem("mock_user", JSON.stringify(user));
  notifyAuthChange();
  return user;
}

export async function logoutUser(): Promise<void> {
  currentUser = null;
  localStorage.removeItem("mock_user");
  notifyAuthChange();
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  // on init, check local storage
  if (!currentUser) {
    const stored = localStorage.getItem("mock_user");
    if (stored) {
      currentUser = JSON.parse(stored);
    }
  }
  return auth.onAuthStateChanged(callback);
}

// ─── Token Helper ───

export async function getIdToken(): Promise<string | null> {
  if (!currentUser) return null;
  return currentUser.getIdToken();
}

// ─── Session API ───

export async function fetchSessions(): Promise<ChatSession[]> {
  return [];
}

export async function createSession(): Promise<ChatSession> {
  return {
    session_id: "mock-" + Date.now(),
    title: "Mock Session",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    message_count: 0
  };
}

export async function fetchSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  return [];
}

// ─── Stream Query ───

export function streamQueryUrl(): string {
  return `http://localhost:8001/api/v1/query/stream`;
}

export interface UserProfile {
  semester: string;
  stream: string;
  batch: string;
  rollNumber: string;
}

export async function fetchProfile(): Promise<UserProfile | null> {
  return {
    semester: "6th",
    stream: "cse",
    batch: "2024",
    rollNumber: "12345"
  };
}

export async function updateProfileName(name: string): Promise<boolean> {
  if (currentUser) {
    currentUser.displayName = name;
    localStorage.setItem("mock_user", JSON.stringify(currentUser));
    notifyAuthChange();
  }
  return true;
}

export interface DocumentInfo {
  document_id: string;
  source: string;
  title: string | null;
  semester: string | null;
  stream: string | null;
  subject: string | null;
  chunks: number;
  created_at: string;
}

export async function fetchDocuments(): Promise<DocumentInfo[]> {
  return [
    {
      document_id: "doc-1",
      source: "Computer Networks Lecture 1.pdf",
      title: "Introduction to OSI Model",
      semester: "6th",
      stream: "cse",
      subject: "Computer Networks",
      chunks: 10,
      created_at: new Date().toISOString(),
    },
    {
      document_id: "doc-3",
      source: "Module 2: Data Link Layer.pdf",
      title: "Error Detection and Correction",
      semester: "6th",
      stream: "cse",
      subject: "Computer Networks",
      chunks: 12,
      created_at: new Date().toISOString(),
    },
    {
      document_id: "doc-4",
      source: "Module 3: Network Layer.pdf",
      title: "IPv4 and IPv6 Addressing",
      semester: "6th",
      stream: "cse",
      subject: "Computer Networks",
      chunks: 15,
      created_at: new Date().toISOString(),
    },
    {
      document_id: "doc-2",
      source: "DBMS_Notes.pdf",
      title: "Relational Algebra",
      semester: "5th",
      stream: "cse",
      subject: "DBMS",
      chunks: 15,
      created_at: new Date().toISOString(),
    },
    {
      document_id: "doc-5",
      source: "DBMS Module 2: SQL.pdf",
      title: "Advanced SQL Queries",
      semester: "5th",
      stream: "cse",
      subject: "DBMS",
      chunks: 18,
      created_at: new Date().toISOString(),
    },
    {
      document_id: "doc-6",
      source: "DBMS Module 3: Normalization.pdf",
      title: "1NF, 2NF, 3NF and BCNF",
      semester: "5th",
      stream: "cse",
      subject: "DBMS",
      chunks: 20,
      created_at: new Date().toISOString(),
    },
    {
      document_id: "doc-7",
      source: "OS Unit 1: Introduction.pdf",
      title: "Operating Systems Basics",
      semester: "4th",
      stream: "cse",
      subject: "Operating Systems",
      chunks: 14,
      created_at: new Date().toISOString(),
    },
    {
      document_id: "doc-8",
      source: "OS Unit 2: Process Management.pdf",
      title: "CPU Scheduling Algorithms",
      semester: "4th",
      stream: "cse",
      subject: "Operating Systems",
      chunks: 22,
      created_at: new Date().toISOString(),
    },
    {
      document_id: "doc-9",
      source: "Python Programming Module 1.pdf",
      title: "Fundamentals & Data Structures",
      semester: "3rd",
      stream: "cse",
      subject: "Python Programming",
      chunks: 10,
      created_at: new Date().toISOString(),
    },
    {
      document_id: "doc-10",
      source: "Discrete Mathematics Unit 1.pdf",
      title: "Set Theory & Predicate Logic",
      semester: "3rd",
      stream: "cse",
      subject: "Discrete Maths",
      chunks: 35,
      created_at: new Date().toISOString(),
    },
    {
      document_id: "doc-11",
      source: "AI Unit 1: Introduction.pdf",
      title: "Intelligent Agents and Search",
      semester: "7th",
      stream: "cse",
      subject: "Artificial Intelligence",
      chunks: 12,
      created_at: new Date().toISOString(),
    },
    {
      document_id: "doc-12",
      source: "Cloud Computing Basics.pdf",
      title: "AWS, Azure and GCP Overview",
      semester: "7th",
      stream: "cse",
      subject: "Cloud Computing",
      chunks: 28,
      created_at: new Date().toISOString(),
    }
  ];
}

// ─── Quiz Generation ───

export interface QuizOption {
  label: string; // "A", "B", "C", "D"
  text: string;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: QuizOption[];
  correct_option: string; // "A", "B", "C", or "D"
  explanation: string;
}

export interface QuizResponse {
  quiz_id: string;
  subject: string;
  num_questions: number;
  questions: QuizQuestion[];
  generated_at: string;
  context_chunks_used: number;
}

export async function generateQuiz(
  subject: string | null,
  numQuestions: number,
  documentId?: string
): Promise<QuizResponse> {
  await new Promise(resolve => setTimeout(resolve, 800));
  return {
    quiz_id: "mock-quiz-" + Date.now().toString(),
    subject: subject || "All Subjects",
    num_questions: numQuestions,
    generated_at: new Date().toISOString(),
    context_chunks_used: 5,
    questions: Array.from({ length: numQuestions }).map((_, i) => ({
      id: i + 1,
      question: `This is a mock question #${i + 1} for ${subject || "General"}?`,
      options: [
        { label: "A", text: "Correct Option" },
        { label: "B", text: "Incorrect Option 1" },
        { label: "C", text: "Incorrect Option 2" },
        { label: "D", text: "Incorrect Option 3" }
      ],
      correct_option: "A",
      explanation: "This is a mock explanation to help you understand the correct answer."
    }))
  };
}

export interface QuizHistoryEntry {
  quiz_id: string;
  subject: string;
  score: number;
  total_questions: number;
  percentage: number;
  submitted_at: string;
}

export async function submitQuiz(
  quizId: string,
  subject: string,
  score: number,
  totalQuestions: number
): Promise<boolean> {
  return true;
}

export async function getQuizHistory(): Promise<QuizHistoryEntry[]> {
  return [
    {
      quiz_id: "mock-1",
      subject: "Computer Networks",
      score: 8,
      total_questions: 10,
      percentage: 80,
      submitted_at: new Date(Date.now() - 86400000).toISOString()
    }
  ];
}
