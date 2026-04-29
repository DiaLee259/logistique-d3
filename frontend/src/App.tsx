import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import AppLayout from '@/components/AppLayout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Articles from '@/pages/Articles';
import Mouvements from '@/pages/Mouvements';
import Commandes from '@/pages/Commandes';
import CommandeDetail from '@/pages/CommandeDetail';
import Livraisons from '@/pages/Livraisons';
import Parametres from '@/pages/Parametres';
import PrestaireForm from '@/pages/PrestaireForm';
import CommandesTS from '@/pages/CommandesTS';
import Inventaire from '@/pages/Inventaire';
import Guide from '@/pages/Guide';
import Corbeille from '@/pages/Corbeille';
import NotFound from '@/pages/NotFound';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Chargement…</p>
      </div>
    </div>
  );
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      {/* Route publique prestataire */}
      <Route path="/commande-publique/:token" element={<PrestaireForm />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="articles" element={<Articles />} />
        <Route path="mouvements" element={<Mouvements />} />
        <Route path="commandes" element={<Commandes />} />
        <Route path="commandes/:id" element={<CommandeDetail />} />
        <Route path="livraisons" element={<Livraisons />} />
        <Route path="commandes-ts" element={<CommandesTS />} />
        <Route path="inventaire" element={<Inventaire />} />
        <Route path="guide" element={<Guide />} />
        <Route path="corbeille" element={<Corbeille />} />
        <Route path="parametres" element={<Parametres />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
