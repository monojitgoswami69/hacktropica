import './globals.css';
import { AppProvider } from '../context/AppContext';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { ToastContainer } from '../components/UI/ToastContainer';

export const metadata = {
  title: 'Vidyarthi Sarthi Admin Dashboard',
  description: 'Admin dashboard for managing Vidyarthi Sarthi knowledge base, documents, and system instructions',
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#6366F1' },
    { media: '(prefers-color-scheme: dark)', color: '#09090B' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <AppProvider>
            <ToastProvider>
              {children}
              <ToastContainer />
            </ToastProvider>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
