import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import Logo from '@/components/Logo';

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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f1523 0%, #181d2e 50%, #0f1523 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Logo TechnoSmart */}
        <div className="flex flex-col items-center mb-8">
          <div className="rounded-xl overflow-hidden mb-4 px-6 py-3" style={{ background: '#181d2e' }}>
            <Logo height={52} />
          </div>
          <p className="text-blue-300/60 text-xs tracking-wide uppercase">Logistique · Fibre Optique</p>
        </div>

        {/* Card connexion */}
        <div className="rounded-2xl p-6 shadow-2xl border border-white/10" style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
          <h2 className="text-base font-semibold text-white mb-5">Connexion</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-blue-200/80 mb-1.5">Adresse email</label>
              <input
                {...register('email')}
                type="email"
                placeholder="prenom.nom@technosmart.fr"
                autoComplete="email"
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg bg-white/8 border text-white placeholder-white/25 text-sm outline-none transition-colors',
                  'focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30',
                  errors.email ? 'border-red-400' : 'border-white/15',
                )}
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-xs font-medium text-blue-200/80 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={cn(
                    'w-full px-3 py-2.5 pr-10 rounded-lg bg-white/8 border text-white placeholder-white/25 text-sm outline-none transition-colors',
                    'focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30',
                    errors.password ? 'border-red-400' : 'border-white/15',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: loading ? '#1e3a8a' : 'linear-gradient(90deg,#1d4ed8,#2563eb)', color: '#fff' }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          {/* Comptes de démo */}
          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="text-xs text-white/30 text-center mb-3">Accès rapide (démo)</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Log. Backoffice', email: 'log1@logistique-d3.fr' },
                { label: 'Log. Terrain',    email: 'log2@logistique-d3.fr' },
                { label: 'Chef de projet',  email: 'chef@logistique-d3.fr' },
                { label: 'Admin',           email: 'admin@logistique-d3.fr' },
              ].map(({ label, email }) => (
                <button
                  key={email}
                  type="button"
                  onClick={() => login(email, 'password123').catch(() => {})}
                  className="text-xs py-1.5 px-2 rounded-lg border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/8 transition-colors text-left"
                >
                  <span className="font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-white/20 text-xs mt-6">
          TechnoSmart — La puissance du réseau intelligent
        </p>
      </div>
    </div>
  );
}
