import { useState, useEffect } from "react";
import { FolderKanban, Home, Plus, Users, Settings, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface Project {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  created_at: string;
}

const navigationItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "My Projects", url: "/projects", icon: FolderKanban },
  { title: "Team", url: "/team", icon: Users },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  const collapsed = state === "collapsed";

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth');
      toast({
        title: "Signed out successfully",
        description: "You have been logged out of TaskHuddle.",
      });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error signing out",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary text-primary-foreground font-medium shadow-card" 
      : "hover:bg-accent hover:text-accent-foreground transition-smooth";

  const userInitials = user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <Sidebar 
      className={`${collapsed ? "w-16" : "w-64"} border-r bg-gradient-subtle transition-smooth`}
      collapsible="icon"
    >
      <SidebarContent className="p-4">
        {/* User Profile Section */}
        <div className="mb-6 p-3 rounded-xl bg-gradient-card shadow-card">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border-2 border-primary/20">
              <AvatarImage src="" />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-muted-foreground">Team Member</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground font-semibold">
            {!collapsed && "Navigation"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Recent Projects */}
        {!collapsed && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-muted-foreground font-semibold flex items-center justify-between">
              Recent Projects
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => navigate('/projects/new')}>
                <Plus className="h-3 w-3" />
              </Button>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-8 bg-muted/50 rounded animate-pulse" />
                    ))}
                  </div>
                ) : projects.length > 0 ? (
                  projects.map((project) => (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton asChild>
                        <NavLink 
                          to={`/project/${project.id}`} 
                          className="flex items-center justify-between hover:bg-accent hover:text-accent-foreground transition-smooth rounded-lg p-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <span className="text-sm truncate">{project.name}</span>
                          </div>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground p-2">No projects yet</p>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Sign Out Button */}
        <div className="mt-auto pt-4">
          <Button 
            variant="ghost" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-smooth"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}