import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { FolderKanban, Users, Zap } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex flex-col">
      <header className="p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            TaskHuddle
          </h1>
          <Button onClick={() => navigate('/auth')} className="bg-gradient-primary text-white shadow-elegant">
            Sign In
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h2 className="text-5xl font-bold text-foreground">
              Collaborate. Organize. <span className="bg-gradient-primary bg-clip-text text-transparent">Achieve.</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              TaskHuddle brings your team together with intuitive Kanban boards, real-time collaboration, and powerful project management tools.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate('/auth')}
              className="bg-gradient-primary text-white shadow-elegant hover:shadow-glow transition-smooth"
            >
              Get Started Free
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="text-center space-y-4">
              <div className="bg-primary/10 p-4 rounded-xl w-fit mx-auto">
                <FolderKanban className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Project Management</h3>
              <p className="text-muted-foreground">Organize tasks with intuitive Kanban boards and track progress in real-time.</p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="bg-primary/10 p-4 rounded-xl w-fit mx-auto">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Team Collaboration</h3>
              <p className="text-muted-foreground">Work together seamlessly with role-based access and real-time updates.</p>
            </div>
            
            <div className="text-center space-y-4">
              <div className="bg-primary/10 p-4 rounded-xl w-fit mx-auto">
                <Zap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Real-time Sync</h3>
              <p className="text-muted-foreground">Stay synchronized with instant notifications and live collaboration features.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
