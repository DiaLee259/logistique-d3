import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl font-semibold text-foreground mb-2">Page introuvable</p>
        <p className="text-muted-foreground mb-6">Cette page n'existe pas ou a été déplacée.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
          <Home className="w-4 h-4" />
          Retour au dashboard
        </Link>
      </div>
    </div>
  );
}
