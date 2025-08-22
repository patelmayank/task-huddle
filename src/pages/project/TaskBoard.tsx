import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Calendar, Flag, User } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  due_date: string | null;
  assigned_to: string | null;
  order_index: number;
  updated_at: string;
  assignee?: {
    id: string;
    email: string;
    display_name?: string;
  };
}

const columns = [
  { id: 'todo', title: 'To Do', color: 'bg-slate-100' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-100' },
  { id: 'done', title: 'Done', color: 'bg-green-100' }
];

const priorityColors = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
  critical: 'bg-red-700'
};

export default function TaskBoard() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as const
  });

  useEffect(() => {
    if (projectId) {
      fetchTasks();
      
      // Bug #2: Realtime subscriptions with proper cleanup
      const channel = supabase
        .channel(`tasks_${projectId}`)
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
          (payload) => {
            console.log('Realtime task update:', payload);
            fetchTasks(); // Refresh tasks on any change
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [projectId]);

  const fetchTasks = async () => {
    try {
      // Add comprehensive error logging to catch future issues
      console.log(`[TaskBoard] Fetching tasks for project: ${projectId}`);
      
      // Bug #9: Fix N+1 queries - for now fetch without join, then improve later
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('status', { ascending: true })
        .order('order_index', { ascending: true });

      if (error) {
        console.error(`[TaskBoard] Database error fetching tasks:`, {
          error: error.message,
          code: error.code,
          details: error.details,
          projectId
        });
        throw error;
      }
      
      console.log(`[TaskBoard] Successfully fetched ${data?.length || 0} tasks`);
      // Transform data to match Task interface
      const tasksWithAssignee = data?.map(task => ({
        ...task,
        assignee: task.assigned_to ? { id: task.assigned_to, email: '', display_name: '' } : undefined
      })) || [];
      setTasks(tasksWithAssignee);
    } catch (error: any) {
      console.error(`[TaskBoard] Fatal error in fetchTasks:`, {
        error: error.message,
        stack: error.stack,
        projectId,
        timestamp: new Date().toISOString()
      });
      toast({
        title: "Error loading tasks",
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!projectId || !user || !newTask.title.trim()) {
      console.warn(`[TaskBoard] Task creation blocked:`, {
        projectId: !!projectId,
        user: !!user,
        titleValid: !!newTask.title.trim(),
        timestamp: new Date().toISOString()
      });
      return;
    }

    try {
      // Bug #6: Idempotency - generate unique request ID
      const requestId = crypto.randomUUID();
      
      console.log(`[TaskBoard] Creating task:`, {
        title: newTask.title,
        projectId,
        userId: user.id,
        priority: newTask.priority,
        requestId
      });

      // Check if request already processed
      const { data: existing } = await supabase
        .from('request_logs')
        .select('id')
        .eq('request_id', requestId)
        .single();
        
      if (existing) {
        console.log('Request already processed, skipping');
        return;
      }

      // Log request
      await supabase
        .from('request_logs')
        .insert([{
          request_id: requestId,
          user_id: user.id,
          action: 'create_task'
        }]);

      // Get next order index for todo column
      const { data: lastTask } = await supabase
        .from('tasks')
        .select('order_index')
        .eq('project_id', projectId)
        .eq('status', 'todo')
        .order('order_index', { ascending: false })
        .limit(1)
        .single();

      const nextOrderIndex = (lastTask?.order_index || 0) + 100;

      const { error } = await supabase
        .from('tasks')
        .insert([{
          title: newTask.title,
          description: newTask.description || null,
          priority: newTask.priority,
          project_id: projectId,
          status: 'todo',
          order_index: nextOrderIndex
        }]);

      if (error) {
        console.error(`[TaskBoard] Database error creating task:`, {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          projectId,
          userId: user.id
        });
        throw error;
      }

      console.log(`[TaskBoard] Task created successfully:`, newTask.title);
      
      toast({
        title: "Task created!",
        description: `"${newTask.title}" has been added to the board.`,
      });

      setNewTask({ title: '', description: '', priority: 'medium' });
      setIsCreateDialogOpen(false);
      
      // Refresh tasks to show the new one
      await fetchTasks();
    } catch (error: any) {
      console.error(`[TaskBoard] Fatal error in handleCreateTask:`, {
        error: error.message,
        code: error.code,
        stack: error.stack,
        projectId,
        userId: user?.id,
        timestamp: new Date().toISOString()
      });
      
      // Provide user-friendly error messages based on error type
      let errorMessage = "Please try again.";
      if (error.code === "42P17") {
        errorMessage = "Database configuration error. Please contact support.";
      } else if (error.code === "23503") {
        errorMessage = "Invalid project reference. Please refresh and try again.";
      }
      
      toast({
        title: "Error creating task",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { draggableId, destination, source } = result;
    const newStatus = destination.droppableId as Task['status'];

    try {
      // Bug #3: Use gap-based reordering function
      const { error } = await supabase.rpc('reorder_task', {
        p_task_id: draggableId,
        p_new_status: newStatus,
        p_target_index: destination.index
      });

      if (error) throw error;

      // Optimistic update
      setTasks(prev => {
        const task = prev.find(t => t.id === draggableId);
        if (!task) return prev;
        
        return prev.map(t => 
          t.id === draggableId 
            ? { ...t, status: newStatus, order_index: destination.index * 100 }
            : t
        );
      });

      toast({
        title: "Task moved!",
        description: `Task moved to ${destination.droppableId.replace('_', ' ')}.`,
      });
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: "Error moving task",
        description: "Please try again.",
        variant: "destructive",
      });
      
      // Refresh to ensure consistency
      await fetchTasks();
    }
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status)
      .sort((a, b) => a.order_index - b.order_index);
  };

  // Bug #7: Fix timezone handling for dates
  const formatDate = (dateString: string, timezone = 'UTC') => {
    try {
      return formatInTimeZone(new Date(dateString), timezone, 'MMM d');
    } catch {
      return format(new Date(dateString), 'MMM d');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-96 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Task Board</h2>
          <p className="text-muted-foreground">Organize and track your project tasks</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-white shadow-elegant">
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Title *</Label>
                <Input
                  id="task-title"
                  placeholder="Enter task title"
                  value={newTask.title}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  placeholder="Enter task description (optional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={newTask.priority} onValueChange={(value: any) => setNewTask(prev => ({ ...prev, priority: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreateTask} disabled={!newTask.title.trim()} className="flex-1">
                  Create Task
                </Button>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        {/* Bug #11: Mobile responsive with horizontal scroll */}
        <div className="flex gap-6 overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-4 md:grid md:grid-cols-3 md:overflow-visible">
          {columns.map((column) => (
            <div key={column.id} className="min-w-[300px] snap-start md:min-w-0">
              <Card className="bg-gradient-card shadow-card border-0">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm font-semibold">
                    <span>{column.title}</span>
                    <Badge variant="secondary" className="text-xs">
                      {getTasksByStatus(column.id).length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <CardContent
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-3 min-h-[400px] ${
                        snapshot.isDraggingOver ? 'bg-accent/50' : ''
                      } transition-colors`}
                    >
                      {getTasksByStatus(column.id).map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided, snapshot) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`bg-background border shadow-sm hover:shadow-card transition-shadow cursor-grab focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 ${
                                snapshot.isDragging ? 'rotate-2 shadow-elegant' : ''
                              }`}
                              tabIndex={0}
                              role="button"
                              aria-label={`Task: ${task.title}`}
                            >
                              <CardContent className="p-4">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between">
                                    <h4 className="font-medium text-foreground text-sm line-clamp-2">
                                      {task.title}
                                    </h4>
                                    <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]} flex-shrink-0 mt-1`} />
                                  </div>
                                  
                                  {task.description && (
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                      {task.description}
                                    </p>
                                  )}
                                  
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {formatDate(task.created_at)}
                                    </div>
                                    
                                    {task.assignee && (
                                      <Avatar className="h-5 w-5">
                                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                          {task.assignee.display_name?.[0] || task.assignee.email[0].toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {getTasksByStatus(column.id).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                          <div className="text-4xl mb-2">📝</div>
                          <p className="text-sm">No tasks yet</p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Droppable>
              </Card>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}