import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, KanbanSquare, Settings, Users } from 'lucide-react';

interface ProjectNavigationProps {
  projectId: string;
  className?: string;
}

const navigationItems = [
  {
    id: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    href: 'overview'
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: KanbanSquare,
    href: 'tasks'
  },
  {
    id: 'team',
    label: 'Team',
    icon: Users,
    href: 'team'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: 'settings'
  }
];

export function ProjectNavigation({ projectId, className }: ProjectNavigationProps) {
  return (
    <nav className={cn("flex space-x-1 bg-muted/30 p-1 rounded-lg", className)}>
      {navigationItems.map((item) => (
        <NavLink
          key={item.id}
          to={`/project/${projectId}/${item.href}`}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-smooth",
              "hover:bg-background hover:text-foreground",
              isActive
                ? "bg-background text-foreground shadow-card"
                : "text-muted-foreground"
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}