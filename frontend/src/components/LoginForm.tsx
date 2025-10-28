import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
}

const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getFirebaseErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'Usuário não encontrado.';
      case 'auth/wrong-password':
        return 'Senha incorreta.';
      case 'auth/invalid-email':
        return 'Email inválido.';
      case 'auth/user-disabled':
        return 'Conta desabilitada.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Tente novamente mais tarde.';
      case 'auth/network-request-failed':
        return 'Erro de conexão. Verifique sua internet.';
      case 'auth/invalid-credential':
        return 'Credenciais inválidas. Verifique email e senha.';
      default:
        return 'Erro no login. Tente novamente.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha email e senha.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      console.log('🔐 Tentando fazer login com:', email);
      await onLogin(email, password);
      console.log('✅ Login realizado com sucesso!');
      toast({
        title: "Login realizado com sucesso!",
        description: "Bem-vindo ao sistema.",
      });
    } catch (error: any) {
      console.error('Erro no login:', error);
      
      const errorMessage = getFirebaseErrorMessage(error.code);
      
      toast({
        title: "Erro no login",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-dark-navy-950">
      {/* Efeitos de luz sutis no background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-96 h-96 bg-mint-glow/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-mint-glow/3 rounded-full blur-3xl"></div>
      </div>

              <Card className="w-full max-w-md bg-dark-navy-950/95 backdrop-blur-sm border border-mint-glow/20 rounded-2xl relative z-10">
        <CardHeader className="text-center space-y-6 pb-8 pt-12">
          {/* Logo/Icon */}
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-mint-glow to-secondary rounded-2xl flex items-center justify-center hover:scale-105 transition-all duration-300">
            <svg className="w-10 h-10 text-dark-navy" fill="currentColor" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.479 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
            </svg>
          </div>
          
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-mint-glow to-secondary bg-clip-text text-transparent">
              clínica.ia
            </CardTitle>
            <CardDescription className="text-mint-glow/70 mt-2 text-base">
              Inteligência Artificial
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-mint-glow/90 font-medium">
                Email
              </Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu@email.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                disabled={isLoading} 
                className="h-12 bg-dark-navy-950/70 border border-mint-glow/30 focus:border-mint-glow text-mint-glow placeholder:text-mint-glow/50 rounded-xl transition-all duration-300" 
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-mint-glow/90 font-medium">
                Senha
              </Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                disabled={isLoading} 
                className="h-12 bg-dark-navy-950/70 border border-mint-glow/30 focus:border-mint-glow text-mint-glow placeholder:text-mint-glow/50 rounded-xl transition-all duration-300" 
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-12 bg-gradient-to-r from-mint-glow to-secondary hover:from-mint-glow/90 hover:to-secondary/90 text-dark-navy font-semibold rounded-xl transition-all duration-300 hover:scale-[1.02]" 
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-dark-navy border-t-transparent rounded-full animate-spin"></div>
                  Entrando...
                </div>
              ) : (
                'Entrar no Sistema'
              )}
            </Button>
          </form>
          
          <div className="mt-6 p-4 bg-dark-navy-950/50 rounded-xl border border-mint-glow/10">
            <p className="text-sm text-mint-glow/70 text-center">
              <strong className="text-mint-glow">Firebase Authentication</strong><br />
              <span className="text-xs text-mint-glow/60">
                Faça login com sua conta Firebase
              </span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginForm;