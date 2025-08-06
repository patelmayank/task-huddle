import { useState, useEffect } from 'react';
import { useParams, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProjectNavigation } from '@/components/project/ProjectNavigation';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  owner_id: string;
  task_count?: number;
  member_count?: number;
}

export default function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId && user && !authLoading) {
      fetchProject();
    }
  }, [projectId, user, authLoading]);

  const fetchProject = async () => {
    if (!projectId) return;
    
    try {
      // Fetch project with task count
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(`
          *,
          tasks(count)
        `)
        .eq('id', projectId)
        .single();

      if (projectError) {
        if (projectError.code === 'PGRST116') {
          setError('Project not found or access denied');
        } else {
          throw projectError;
        }
        return;
      }

      const processedProject = {
        ...projectData,
        task_count: projectData.tasks?.length || 0,
        member_count: 1 // Will be updated when we implement team management
      };

      setProject(processedProject);
    } catch (error: any) {
      console.error('Error fetching project:', error);
      setError('Failed to load project');
      toast({
        title: "Error loading project",
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-6">
        <Card className="p-8 text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Project Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error || "The project you're looking for doesn't exist or you don't have access to it."}
          </p>
          <Button onClick={() => navigate('/dashboard')} className="bg-gradient-primary text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Project Header */}
      <div className="bg-background/95 backdrop-blur border-b sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              
              <div className="h-6 w-px bg-border" />
              
              <div>
                <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {project.description || 'No description provided'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {project.member_count} member{project.member_count !== 1 ? 's' : ''}
                </Badge>
                <Badge variant="outline">
                  {project.task_count} task{project.task_count !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </div>

          {/* Project Navigation */}
          <div className="mt-4">
            <ProjectNavigation projectId={project.id} />
          </div>
        </div>
      </div>

      {/* Project Content */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}