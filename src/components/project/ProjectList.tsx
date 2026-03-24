import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FolderOpen, Trash2, ListTodo, Clock } from "lucide-react";
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

export const ProjectList = () => {
  const { projects, loading, addProject, removeProject } = useProjects();
  const [newProjectName, setNewProjectName] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast.error("Please enter a project name");
      return;
    }
    const project = await addProject(newProjectName.trim());
    setNewProjectName("");
    toast.success(`Project "${project.name}" created`);
  };

  const handleDeleteProject = async () => {
    if (projectToDelete) {
      await removeProject(projectToDelete);
      toast.success("Project deleted");
      setProjectToDelete(null);
    }
  };

  const handleOpenProject = (projectId: string) => {
    navigate(`/project/${projectId}`);
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
        <div className="text-muted-foreground">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">Y</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">YOLO Annotator</h1>
              <p className="text-sm text-muted-foreground">
                Create projects and annotate images for object detection
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Create new project */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Create New Project</CardTitle>
            <CardDescription>
              Organize your work by creating projects, then add tasks inside each project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                placeholder="Enter project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                className="flex-1"
              />
              <Button onClick={handleCreateProject}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Project list */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Your Projects</h2>
          
          {projects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  No projects yet. Create your first project to get started.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => handleOpenProject(project.id)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <ListTodo className="w-4 h-4" />
                            {project.taskCount} tasks
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDate(project.updatedAt)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(project.id);
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
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project, all its tasks, images, and annotations.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProject} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
