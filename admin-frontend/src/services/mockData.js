// Mock Data Service
// Simulates backend responses for local UI development

export const MOCK_USERS = [
  { id: 'usr_1', username: 'admin', email: 'admin@campusdost.com', role: 'admin', full_name: 'System Admin', status: 'active', created_at: '2023-01-01T00:00:00Z' },
  { id: 'usr_2', username: 'moderator1', email: 'mod1@campusdost.com', role: 'moderator', full_name: 'John Doe', status: 'active', created_at: '2023-02-15T08:30:00Z' },
  { id: 'usr_3', username: 'editor1', email: 'editor1@campusdost.com', role: 'editor', full_name: 'Jane Smith', status: 'disabled', created_at: '2023-03-20T10:15:00Z' }
];

export const MOCK_DOCUMENTS = [
  { id: 'doc_1', filename: 'student-handbook-2023.pdf', status: 'processed', uploaded_at: new Date(Date.now() - 86400000 * 2).toISOString(), size: 1048576, uploader: 'admin' },
  { id: 'doc_2', filename: 'campus-map.jpg', status: 'processed', uploaded_at: new Date(Date.now() - 86400000 * 5).toISOString(), size: 204800, uploader: 'John Doe' },
  { id: 'doc_3', filename: 'academic-calendar.pdf', status: 'processing', uploaded_at: new Date().toISOString(), size: 512000, uploader: 'Jane Smith' },
];

export const MOCK_ARCHIVE = [
  { id: 'arch_1', filename: 'student-handbook-2022.pdf', archived_at: new Date(Date.now() - 86400000 * 30).toISOString(), size: 950000, archived_by: 'admin' }
];

export const MOCK_ACTIVITY = Array.from({ length: 15 }).map((_, i) => {
  const actions = ['document_uploaded', 'document_archived', 'document_deleted', 'user_login', 'settings_changed'];
  const filenames = ['guidelines.pdf', 'schedule.docx', 'policies.pdf'];
  const action = actions[Math.floor(Math.random() * actions.length)];
  return {
    id: `act_${i}`,
    action: action,
    actor: Math.random() > 0.5 ? 'admin' : 'John Doe',
    timestamp: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
    meta: action.startsWith('document') ? { filename: filenames[Math.floor(Math.random() * filenames.length)] } : {}
  };
});

export const MOCK_WEEKLY_ACTIVITY = Array.from({ length: 7 }).map((_, i) => {
  const date = new Date(Date.now() - (6 - i) * 86400000);
  return {
    date: date.toISOString(),
    queries: Math.floor(Math.random() * 100) + 20
  };
});

// Interceptor function to route paths to mock responses
export const mockApiInterceptor = async (url, options) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 600));

  const path = url.replace(/https?:\/\/[^\/]+/, '');
  const method = (options.method || 'GET').toUpperCase();

  console.log(`[Mock API] ${method} ${path}`, options.body ? JSON.parse(options.body) : '');

  // Auth mock
  if (path.includes('/api/v1/auth/login') && method === 'POST') {
    const body = JSON.parse(options.body);
    if (body.username && body.password) {
      return { 
        status: 'success', 
        user: MOCK_USERS[0],
        token: 'mock-jwt-token-xyz'
      };
    }
    throw new Error('Invalid credentials');
  }

  // Dashboard & Health stats mocks
  if (path.includes('/health')) {
    return { status: 'ok' };
  }
  if (path.includes('/api/v1/dashboard/stats')) {
    return {
      totalUsers: MOCK_USERS.length,
      totalDocuments: MOCK_DOCUMENTS.length,
      activeDocuments: MOCK_DOCUMENTS.filter(d => d.status === 'processed').length,
      archivedDocuments: MOCK_ARCHIVE.length
    };
  }
  if (path.includes('/api/v1/dashboard/activity')) {
    return { activity: MOCK_ACTIVITY.slice(0, 10) };
  }
  if (path.includes('/api/v1/dashboard/weekly')) {
    return { weekly: MOCK_WEEKLY_ACTIVITY };
  }

  // Knowledge base mocks
  if (path.includes('/api/v1/knowledge-base/files') || path.includes('/api/v1/knowledge-base/documents')) {
    return { documents: MOCK_DOCUMENTS };
  }
  if (path.includes('/api/v1/knowledge-base/document/') && method === 'DELETE') {
    return { status: 'success' };
  }

  // Users mocks
  if (path.includes('/api/v1/users') && method === 'GET') {
    return { status: 'success', users: MOCK_USERS, total: MOCK_USERS.length };
  }

  // System instructions mock
  if (path.includes('/api/v1/system-instructions')) {
    return { content: "You are Vidyarthi Sarthi, a helpful AI assistant for students.", version: 1 };
  }

  // Archive mocks
  if (path.includes('/api/v1/archive') && method === 'GET') {
    return { documents: MOCK_ARCHIVE };
  }

  // Unhandled path, return empty success or throw (throwing to easily spot missing mocks)
  return { status: 'success', message: 'Mock response placeholder for unhandled path' };
};
