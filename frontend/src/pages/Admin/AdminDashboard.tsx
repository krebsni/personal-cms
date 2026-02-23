import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Users, Shield, Building } from 'lucide-react';
import { useFetchUsers, useAssignUser } from '../../hooks/useAdminApi';
import { useFetchRepositories } from '../../hooks/useRepositoriesApi';

export const AdminDashboard: React.FC = () => {
  const [assignUserModalOpen, setAssignUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<'viewer' | 'editor'>('viewer');

  const { data: users, isLoading: usersLoading, error: usersError } = useFetchUsers();
  const { data: repositories, isLoading: reposLoading } = useFetchRepositories();
  const assignMutation = useAssignUser();

  const openAssignModal = (user: any) => {
    setSelectedUser(user);
    if (repositories && repositories.length > 0) {
      setSelectedRepo(repositories[0].id);
    }
    setAssignUserModalOpen(true);
  };

  const handleAssign = async () => {
    if (!selectedRepo || !selectedUser) return;

    try {
      await assignMutation.mutateAsync({
        resourceId: selectedRepo,
        email: selectedUser.email,
        role: selectedRole
      });
      setAssignUserModalOpen(false);
    } catch (err) {
      console.error("Assignment failed:", err);
      // In a real app we would use a toast notification here
      alert("Failed to assign user. Only owners or admins can manage assignments.");
    }
  };

  if (usersLoading) return <div className="p-8">Loading dashboard...</div>;
  if (usersError) return <div className="p-8 text-destructive">Failed to load users: {usersError.message}</div>;

  const totalUsers = users?.length || 0;
  const activeRepos = repositories?.length || 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage users, roles, and system settings.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Repositories</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reposLoading ? '...' : activeRepos}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>View all registered users and assign them to repositories.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {user.role === 'admin' && <Shield className="h-4 w-4 text-primary" />}
                        <span className="capitalize">{user.role}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.createdAt ? new Date(user.createdAt * 1000).toLocaleDateString() : 'Unknown'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openAssignModal(user)}>
                        Assign Access
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Assignment Modal */}
      <Dialog open={assignUserModalOpen} onOpenChange={setAssignUserModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Repository Access</DialogTitle>
            <DialogDescription>
              Assign {selectedUser?.username} to a repository with specific permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="repository">Repository</Label>
              <select
                id="repository"
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {repositories?.map(repo => (
                  <option key={repo.id} value={repo.id} className="bg-background text-foreground">{repo.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as 'viewer' | 'editor')}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="viewer" className="bg-background text-foreground">Viewer (Read Only)</option>
                <option value="editor" className="bg-background text-foreground">Editor (Read / Write)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignUserModalOpen(false)} disabled={assignMutation.isPending}>Cancel</Button>
            <Button type="button" onClick={handleAssign} disabled={assignMutation.isPending || !selectedRepo}>
              {assignMutation.isPending ? 'Assigning...' : 'Assign User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
