import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { GlassCard, GlassButton } from '../ui/GlassUI';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { SYSTEM_VIEWS } from '../../lib/mockData';

interface WelcomeScreenProps {
  onEnter: () => void;
  onLoginSuccess: (user: any, googleEmail: string) => void;
  addToast: (msg: string, type: 'success' | 'warning' | 'error' | 'info') => void;
}

function CybercoreBackground() {
  const beams = Array.from({ length: 60 }, (_, i) => {
    const riseDur = Math.random() * 4 + 5;
    const type = Math.random() < 0.15 ? 'secondary' : 'primary';
    return {
      id: i,
      type,
      left: `${Math.random() * 100}%`,
      width: `${Math.floor(Math.random() * 2) + 1}px`,
      height: `${Math.floor(Math.random() * 15) + 10}%`,
      delay: `${Math.random() * 8}s`,
      duration: `${riseDur}s`,
    };
  });

  return (
    <div className="cybercore-scene" aria-hidden="true">
      <div className="cybercore-floor" />
      <div className="cybercore-column" />
      {beams.map(beam => (
        <div
          key={beam.id}
          className={`cybercore-beam ${beam.type}`}
          style={{
            left: beam.left,
            width: beam.width,
            height: beam.height,
            animationDelay: beam.delay,
            animationDuration: `${beam.duration}, ${beam.duration}`,
          }}
        />
      ))}
    </div>
  );
}

export default function WelcomeScreen({ onEnter, onLoginSuccess, addToast }: WelcomeScreenProps) {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authStage, setAuthStage] = useState<null | 'authenticating' | 'verifying_user' | 'authorized' | 'unauthorized' | 'error'>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const verifyingRef = React.useRef(false);


  // General verification of Google Email against authorized users (USUARIOSV2)
  const verifyAndAuthorizeEmail = async (email: string, fullName?: string) => {
    if (verifyingRef.current) {
      console.log("[WelcomeScreen] Already verifying or authorized, skipping duplicate call for", email);
      return;
    }
    verifyingRef.current = true;
    setIsLoggingIn(true);
    setAuthStage('verifying_user');
    setStatusMessage('Consultando base de datos...');
    let isSuccess = false;
    try {
      // Fetch authorized users list from the backend with bypassCache to get the latest profile and permissions
      const res = await fetch('/api/sheets?table=USUARIOSV2&bypassCache=true&source=WelcomeScreen.verifyAndAuthorizeEmail');
      if (!res.ok) {
        throw new Error("No se pudo obtener la lista de usuarios autorizados desde el servidor.");
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const targetEmail = email.trim().toLowerCase();

        // 1. First search for match in the "email" column
        let matched = data.data.find((u: any) => {
          const emailA = String(u.email || u.mail || "").trim().toLowerCase();
          return emailA && emailA === targetEmail;
        });

        // 2. If not found, search in the "email2" column
        if (!matched) {
          matched = data.data.find((u: any) => {
            const emailB = String(u.email2 || "").trim().toLowerCase();
            return emailB && emailB === targetEmail;
          });
        }

        if (matched) {
          isSuccess = true;
          setAuthStage('authorized');
          setStatusMessage('¡Ingreso autorizado con éxito!');
          // Authenticated! Map client properties
          const matchedUserObj = { ...matched };
          if (matchedUserObj.nombre && !matchedUserObj.name) matchedUserObj.name = matchedUserObj.nombre;
          if (matchedUserObj.usuariosap && !matchedUserObj.sapUser) matchedUserObj.sapUser = matchedUserObj.usuariosap;
          if (matchedUserObj.puesto && !matchedUserObj.position) matchedUserObj.position = matchedUserObj.puesto;
          if (matchedUserObj.perfil && !matchedUserObj.profile) matchedUserObj.profile = matchedUserObj.perfil;
          
          // Enforce robust array of permissions on login success to prevent client crashes
          let perms = matchedUserObj.permissions || matchedUserObj.permisos;
          if (typeof perms === 'string' && perms.trim() !== '') {
            try {
              perms = JSON.parse(perms);
            } catch {
              perms = [];
            }
          }
          if (!Array.isArray(perms) || perms.length === 0) {
            const level = (matchedUserObj.profile || matchedUserObj.perfil) === 'Administrador' ? 'EDIT' : 'VIEW';
            perms = SYSTEM_VIEWS.map((v: any) => ({
              viewId: v.id,
              label: v.label,
              section: v.section,
              level: level
            }));
          }
          matchedUserObj.permissions = perms;

          addToast(`Sesión iniciada con éxito como ${matchedUserObj.name || email}`, 'success');
          setTimeout(() => {
            onLoginSuccess(matchedUserObj, email);
          }, 600);
        } else {
          setAuthStage('unauthorized');
          setStatusMessage('Usuario no autorizado. Contacte al administrador.');
          // Sign out of Supabase because this email is not registered in USUARIOSV2
          const supabase = await getSupabaseClient();
          if (supabase) {
            await supabase.auth.signOut();
          }
          addToast(`Usuario no autorizado. Contacte al administrador.`, 'error');
        }
      } else {
        throw new Error(data.error || "Formato de respuesta de usuarios no válido.");
      }
    } catch (err: any) {
      console.error("[VerifyAndAuthorizeEmailError]", err);
      setAuthStage('error');
      setStatusMessage(err.message || "Error al verificar autorización de correo.");
      addToast(err.message || "Error al verificar autorización de correo.", "error");
    } finally {
      setIsLoggingIn(false);
      if (!isSuccess) {
        verifyingRef.current = false;
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    let subscription: any = null;

    async function checkAuth() {
      // If we already have an active saved session running on the main App component, bypass duplicate check
      const savedDni = sessionStorage.getItem('pscqube_user_dni');
      if (savedDni) {
        console.log("[WelcomeScreen] Bypassing auto-login check because savedDni is already active");
        return;
      }

      const supabase = await getSupabaseClient();
      if (!supabase) return;

      // Extract and check if we already have an active Supabase login session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && isMounted) {
        const email = session.user.email;
        if (email) {
          await verifyAndAuthorizeEmail(email, session.user.user_metadata?.full_name);
        }
      }

      // Handle transition automatically when Redirect returns
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user && isMounted) {
          const email = session.user.email;
          if (email) {
            await verifyAndAuthorizeEmail(email, session.user.user_metadata?.full_name);
          }
        }
      });
      subscription = data.subscription;
    }

    checkAuth();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    setAuthStage('authenticating');
    setStatusMessage('Validando usuario');
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) {
        throw new Error('Supabase client is not available. Check your SUPABASE_URL configuration.');
      }

      // Supabase Native SignIn with Google OAuth redirected flow
      const cleanRedirectUrl = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: cleanRedirectUrl,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });

      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('[GoogleLoginOAuthError]', err);
      setAuthStage('error');
      setStatusMessage(err.message || 'Error de conexión con Google Auth.');
      addToast(err.message || 'Error de conexión con Google Auth de Supabase.', 'error');
      setIsLoggingIn(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-bg text-text-main p-4 transition-all duration-500"
      style={{ 
        background: 'radial-gradient(ellipse at bottom, rgba(0,85,150,0.15) 0%, var(--bg-main) 60%)'
      }}
    >
      <CybercoreBackground />

      <main className="relative z-10 w-full max-w-4xl font-sans">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Section 1: Branding */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="space-y-6"
          >
            <div className="space-y-2">
              <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none bg-gradient-to-r from-text-main to-text-main/60 bg-clip-text text-transparent">
                PSCQUBE
              </h1>
              <p className="text-sm font-bold text-primary uppercase tracking-[0.2em] opacity-90">
                Operaciones Digitales
              </p>
            </div>

            <p className="text-lg text-text-muted leading-relaxed max-w-md font-medium">
              Plataforma de control operativo y seguimiento productivo de última generación. Optimización y rendimiento en una sola interfaz.
            </p>
          </motion.div>

          {/* Section 2: Access Gateway */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <GlassCard 
              className="p-8 md:p-10 relative overflow-hidden shadow-2xl border border-border bg-surface/90 dark:bg-surface-elevated/95 min-h-[350px] flex flex-col justify-between"
              style={{ 
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="relative z-10 space-y-8 my-auto">
                {/* 1. Loader & Status sequence pane */}
                {(authStage === 'authenticating' || authStage === 'verifying_user' || authStage === 'authorized') ? (
                  <div className="text-center py-8 space-y-6">
                    <div className="relative flex justify-center">
                      <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      {authStage === 'authorized' && (
                        <div className="absolute inset-0 flex items-center justify-center text-primary font-bold text-lg animate-pulse">✓</div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-text-main tracking-tight uppercase">
                        {authStage === 'authenticating' && "Autenticando con Google"}
                        {authStage === 'verifying_user' && "Consultando base de datos"}
                        {authStage === 'authorized' && "Acceso Autorizado"}
                      </h3>
                      <p className="text-sm font-semibold text-primary font-mono tracking-wide animate-pulse">
                        {statusMessage}
                      </p>
                    </div>

                    <div className="text-[11px] text-text-muted font-bold tracking-widest uppercase opacity-40">
                      Por favor, espere un momento...
                    </div>
                  </div>
                ) : (authStage === 'unauthorized' || authStage === 'error') ? (
                  /* 2. Error or Blocked Access pane */
                  <div className="space-y-6 py-4">
                    <div className="flex items-center gap-3 text-red-500 bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                      <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <h3 className="font-bold text-base leading-tight">Acceso Denegado</h3>
                        <p className="text-xs font-semibold opacity-90 mt-0.5">El correo no pertenece a un personal autorizado.</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm text-text-muted font-medium">
                      <p>
                        Tu identidad se verificó exitosamente en Google, pero tu correo electrónico no tiene permisos en la aplicación.
                      </p>
                      <p className="text-xs bg-surface/50 p-2.5 rounded border border-border italic font-mono text-center">
                        {statusMessage}
                      </p>
                    </div>

                    <div className="pt-2">
                      <GlassButton 
                        onClick={() => {
                          setAuthStage(null);
                          setIsLoggingIn(false);
                          setStatusMessage('');
                        }}
                        className="w-full h-12 text-sm font-bold bg-white/5 border border-border hover:bg-white/10 text-text-main"
                      >
                        Intentar con otra cuenta
                      </GlassButton>
                    </div>
                  </div>
                ) : (
                  /* 3. Normal Access State pane */
                  <>
                    <div>
                      <h2 className="text-xl font-bold text-text-main mb-1">Bienvenido al Sistema</h2>
                      <p className="text-sm text-text-muted font-medium italic">Inicia sesión de forma segura para acceder.</p>
                    </div>

                    <div className="space-y-6 animate-fade-in" id="access-actions">
                      <GlassButton 
                        onClick={handleGoogleLogin}
                        disabled={isLoggingIn}
                        className="w-full h-15 text-base font-bold group bg-primary hover:bg-primary-hover border-none text-white shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                      >
                        <svg className="w-5 h-5 shrink-0 fill-current bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61c-.29 1.5-1.14 2.78-2.4 3.63v3.02h3.88c2.27-2.09 3.58-5.17 3.58-8.5z"/>
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.02c-1.08.72-2.45 1.16-4.05 1.16-3.11 0-5.74-2.11-6.68-4.96H1.21v3.11C3.18 21.88 7.39 24 12 24z"/>
                          <path fill="#FBBC05" d="M5.32 14.27c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.62H1.21C.44 8.16 0 9.88 0 11.72s.44 3.56 1.21 5.1l4.11-3.11z"/>
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.93 1.19 15.24 0 12 0 7.39 0 3.18 2.12 1.21 5.62l4.11 3.11c.94-2.85 3.57-4.98 6.68-4.98z"/>
                        </svg>
                        Ingresar
                      </GlassButton>
                      <p className="text-[11px] text-center text-text-muted font-semibold tracking-wide">
                        Requiere que su email esté registrado
                      </p>
                    </div>
                  </>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </main>

      <footer className="absolute bottom-6 left-0 right-0 text-center opacity-10 pointer-events-none">
        <p className="text-[9px] font-black uppercase tracking-[0.4em] text-text-muted">
          PSCQUBE &copy; 2026
        </p>
      </footer>
    </div>
  );
}
