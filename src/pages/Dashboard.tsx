import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  FolderKanban, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Users,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
  description: string;
  created_at: string;
  task_count?: number;
  completed_tasks?: number;
  recent_activity?: string;
}

interface RecentActivity {
  id: string;
  action: string;
  project_name: string;
  user_name: string;
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    activeProjects: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch projects without joins to avoid recursion
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(6);

      if (projectsError) throw projectsError;

      // Fetch recent tasks separately
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          created_at,
          project_id
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (tasksError) throw tasksError;

      // Get task counts for each project
      const projectsWithTaskCounts = await Promise.all(
        (projectsData || []).map(async (project) => {
          const projectTasks = tasksData?.filter(task => task.project_id === project.id) || [];
          return {
            ...project,
            task_count: projectTasks.length
          };
        })
      );

      // Get project names for activity
      const projectMap = new Map(projectsData?.map(p => [p.id, p.name]) || []);
      
      const activity = tasksData?.map(task => ({
        id: task.id,
        action: 'created a task',
        project_name: projectMap.get(task.project_id) || 'Unknown Project',
        user_name: 'Team Member',
        created_at: task.created_at
      })) || [];

      setProjects(projectsWithTaskCounts);
      setRecentActivity(activity);

      // Calculate stats
      const totalProjects = projectsWithTaskCounts.length;
      const totalTasks = projectsWithTaskCounts.reduce((sum, p) => sum + (p.task_count || 0), 0);
      
      setStats({
        totalProjects,
        totalTasks,
        completedTasks: Math.floor(totalTasks * 0.65), // Mock completion rate
        activeProjects: totalProjects
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast({
        title: "Error loading dashboard",
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getCompletionPercentage = (project: Project) => {
    if (!project.task_count) return 0;
    return Math.floor(Math.random() * 80) + 10; // Mock completion percentage
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <div className="h-8 bg-muted rounded w-64 animate-pulse" />
          <div className="h-4 bg-muted rounded w-96 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gradient-subtle min-h-screen">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome back, {user?.email?.split('@')[0] || 'there'}! 👋
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening with your projects today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Projects
            </CardTitle>
            <FolderKanban className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-success">+2</span> from last month
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Tasks
            </CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-success">+12</span> from last week
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed Tasks
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.completedTasks}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-success">+8</span> this week
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion Rate
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-success">+5%</span> from last month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2">
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-semibold">Recent Projects</CardTitle>
                <CardDescription>Your most recently updated projects</CardDescription>
              </div>
              <Button 
                onClick={() => navigate('/projects/new')}
                className="bg-gradient-primary text-white shadow-elegant hover:shadow-glow transition-smooth"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {projects.length > 0 ? (
                projects.map((project) => {
                  const completion = getCompletionPercentage(project);
                  return (
                    <div 
                      key={project.id} 
                      className="p-4 border border-border rounded-xl bg-background/50 hover:bg-background transition-smooth cursor-pointer group"
                      onClick={() => navigate(`/project/${project.id}`)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-smooth">
                            {project.name}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {project.description || 'No description provided'}
                          </p>
                        </div>
                        <Badge variant="secondary" className="ml-2">
                          {project.task_count || 0} tasks
                        </Badge>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="text-foreground font-medium">{completion}%</span>
                        </div>
                        <Progress value={completion} className="h-2" />
                      </div>
                      
                      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created {formatTimeAgo(project.created_at)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          1 member
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-foreground mb-2">No projects yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first project to get started with TaskHuddle
                  </p>
                  <Button 
                    onClick={() => navigate('/projects/new')}
                    className="bg-gradient-primary text-white shadow-elegant"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Project
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div>
          <Card className="bg-gradient-card shadow-card border-0">
            <CardHeader>
              <CardTitle className="text-xl font-semibold">Recent Activity</CardTitle>
              <CardDescription>Latest updates from your team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.slice(0, 6).map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 border-2 border-primary/20">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {activity.user_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">{activity.user_name}</span>
                        {' '}
                        <span className="text-muted-foreground">{activity.action}</span>
                        {' '}
                        <span className="font-medium">in {activity.project_name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimeAgo(activity.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}