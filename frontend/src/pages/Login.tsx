import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wifi, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Minimum 6 caractères'),
});
type FormData = z.infer<typeof schema>;

export default function Login() {
  const { login } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Connexion réussie');
    } catch {
      // L'intercepteur axios affiche déjà le toast d'erreur
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/30">
            <Wifi className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Logistique D3</h1>
          <p className="text-blue-300/70 text-sm mt-1">Gestion stock fibre optique</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-5">Connexion</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-blue-200 mb-1.5">Adresse email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="vous@logistique-d3.fr"
                autoComplete="email"
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg bg-white/10 border text-white placeholder-white/30 text-sm outline-none transition-colors',
                  'focus:border-primary focus:ring-1 focus:ring-primary',
                  errors.email ? 'border-red-400' : 'border-white/20',
                )}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-blue-200 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={cn(
                    'w-full px-3 py-2.5 pr-10 rounded-lg bg-white/10 border text-white placeholder-white/30 text-sm outline-none transition-colors',
                    'focus:border-primary focus:ring-1 focus:ring-primary',
                    errors.password ? 'border-red-400' : 'border-white/20',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          {/* Comptes de démo */}
          <div className="mt-5 pt-5 border-t border-white/10">
            <p className="text-xs text-white/40 text-center mb-3">Comptes de démonstration</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Log. 1', email: 'log1@logistique-d3.fr' },
                { label: 'Log. 2', email: 'log2@logistique-d3.fr' },
                { label: 'Chef projet', email: 'chef@logistique-d3.fr' },
                { label: 'Admin', email: 'admin@logistique-d3.fr' },
              ].map(({ label, email }) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => {
                    login(email, 'password123').catch(() => {});
                  }}
                  className="text-xs py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 border border-white/10 transition-colors text-left"
                >
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
