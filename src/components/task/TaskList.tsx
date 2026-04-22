import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTasks } from "@/hooks/useTasks";
import { TaskType, AnnotationKind } from "@/types/annotation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, FolderOpen, Trash2, Image, Tag, Clock, ArrowLeft, Video, FileText, Square, Hexagon, Spline, Dot } from "lucide-react";
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
  const [selectedType, setSelectedType] = useState<TaskType>("image");
  const [selectedKind, setSelectedKind] = useState<AnnotationKind>("box");
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreateTask = async () => {
    if (!newTaskName.trim()) {
      toast.error("Please enter a task name");
      return;
    }
    const task = await addTask(newTaskName.trim(), selectedType, selectedKind);
    setNewTaskName("");
    toast.success(`Task "${task.name}" created`);
  };

  const annotationKinds: { kind: AnnotationKind; label: string; desc: string; Icon: typeof Square }[] = [
    { kind: "box", label: "Bounding Box", desc: "Rectangles for object detection", Icon: Square },
    { kind: "polygon", label: "Polygon", desc: "Multi-point outlines for irregular shapes", Icon: Hexagon },
    { kind: "polyline", label: "Polyline", desc: "Connected lines for roads, paths, edges", Icon: Spline },
    { kind: "point", label: "Point / Keypoint", desc: "Single point markers (eyes, joints)", Icon: Dot },
  ];

  const handleDeleteTask = async () => {
    if (taskToDelete) {
      await removeTask(taskToDelete);
      toast.success("Task deleted");
      setTaskToDelete(null);
    }
  };

  const handleOpenTask = (taskId: string, type: TaskType) => {
    if (type === "speech-to-text") {
      navigate(`/project/${projectId}/stt/${taskId}`);
    } else {
      navigate(`/project/${projectId}/task/${taskId}`);
    }
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
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="mr-1">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">Y</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Project</h1>
              <p className="text-sm text-muted-foreground">Manage tasks and annotate images or videos</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Create New Task</CardTitle>
            <CardDescription>Choose a task type and start annotating</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedType("image")}
                className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                  selectedType === "image"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Image className="w-6 h-6 text-primary" />
                <div className="text-left">
                  <p className="font-semibold text-foreground text-sm">Image Annotation</p>
                  <p className="text-xs text-muted-foreground">Bounding boxes for object detection</p>
                </div>
              </button>
              <button
                onClick={() => setSelectedType("speech-to-text")}
                className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                  selectedType === "speech-to-text"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <Video className="w-6 h-6 text-primary" />
                <div className="text-left">
                  <p className="font-semibold text-foreground text-sm">Speech-to-Text</p>
                  <p className="text-xs text-muted-foreground">Video segments with Khmer/English labels</p>
                </div>
              </button>
            </div>

            {selectedType === "image" && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Annotation Type</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {annotationKinds.map(({ kind, label, desc, Icon }) => (
                    <button
                      key={kind}
                      onClick={() => setSelectedKind(kind)}
                      className={`flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-colors text-left ${
                        selectedKind === kind
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <Icon className="w-5 h-5 text-primary" />
                      <p className="font-semibold text-foreground text-xs">{label}</p>
                      <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
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

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Tasks</h2>

          {tasks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No tasks yet. Create your first task to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className="hover:bg-accent/50 transition-colors cursor-pointer group"
                  onClick={() => handleOpenTask(task.id, task.type)}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {task.type === "speech-to-text" ? (
                            <Video className="w-4 h-4 text-primary" />
                          ) : (
                            <Image className="w-4 h-4 text-primary" />
                          )}
                          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                            {task.name}
                          </h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase font-medium">
                            {task.type === "speech-to-text" ? "STT" : (task.annotationKind ?? "box")}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          {task.type === "image" && (
                            <>
                              <span className="flex items-center gap-1">
                                <Image className="w-4 h-4" />
                                {task.imageCount} images
                              </span>
                              <span className="flex items-center gap-1">
                                <Tag className="w-4 h-4" />
                                {task.annotationCount} annotations
                              </span>
                            </>
                          )}
                          {task.type === "speech-to-text" && (
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" />
                              Video annotation
                            </span>
                          )}
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

      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the task and all its data. This action cannot be undone.
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
