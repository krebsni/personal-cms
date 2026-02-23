import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useLogin } from '../../hooks/useAuthApi';

export const LoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loginMutation = useLogin();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Auth backend accepts both email or username,
    // but the backend `login` endpoint currently strictly checks `email`.
    // Wait, checking auth.ts: POST /login checks `email`.
    // We should send it as email for now.
    try {
      await loginMutation.mutateAsync({ identifier, password });
      navigate('/');
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed');
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleLogin}>
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Enter your email to login to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMsg && (
              <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
                {errorMsg}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="identifier">Email</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="m@example.com"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button className="w-full" type="submit" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </Button>
            <div className="text-sm text-center text-muted-foreground w-full">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};
