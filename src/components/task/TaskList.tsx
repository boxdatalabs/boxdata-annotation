import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTasks } from "@/hooks/useTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FolderOpen, Trash2, Image, Tag, Clock, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const TaskList = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { tasks, loading, addTask, removeTask } = useTasks(projectId!);
  const [newTaskName, setNewTaskName] = useState("");
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreateTask = async () => {
    if (!newTaskName.trim()) {
      toast.error("Please enter a task name");
      return;
    }
    const task = await addTask(newTaskName.trim());
    setNewTaskName("");
    toast.success(`Task "${task.name}" created`);
  };

  const handleDeleteTask = async () => {
    if (taskToDelete) {
      await removeTask(taskToDelete);
      toast.success("Task deleted");
      setTaskToDelete(null);
    }
  };

  const handleOpenTask = (taskId: string) => {
    navigate(`/project/${projectId}/task/${taskId}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="mr-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">Y</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{project?.name || "Project"}</h1>
              <p className="text-sm text-muted-foreground">
                Manage tasks and annotate images
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Create new task */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Create New Task</CardTitle>
            <CardDescription>
              Organize your annotations by creating separate tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Enter task name..."
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
                className="flex-1"
              />
              <Button onClick={handleCreateTask}>
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Task list */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Tasks</h2>
          
          {tasks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  No tasks yet. Create your first task to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className="hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => handleOpenTask(task.id)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {task.name}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Image className="w-4 h-4" />
                            {task.imageCount} images
                          </span>
                          <span className="flex items-center gap-1">
                            <Tag className="w-4 h-4" />
                            {task.annotationCount} annotations
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(task.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTaskToDelete(task.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the task and all its images and annotations.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
