import { useState, useCallback, useEffect } from "react";
import { Task, TaskType, AnnotationKind } from "@/types/annotation";
import { createTask, deleteTask, getProjectTasks, getTaskAnnotationCount, getTaskImageCount } from "@/lib/db";

interface TaskWithCounts extends Task {
  imageCount: number;
  annotationCount: number;
}

export const useTasks = (projectId: string) => {
  const [tasks, setTasks] = useState<TaskWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    if (!projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const storedTasks = await getProjectTasks(projectId);
      const tasksWithCounts = await Promise.all(
        storedTasks.map(async (task) => ({
          ...task,
          imageCount: task.type === "image" ? await getTaskImageCount(task.id) : 0,
          annotationCount: task.type === "image" ? await getTaskAnnotationCount(task.id) : 0,
        }))
      );
      setTasks(tasksWithCounts);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const addTask = useCallback((name: string, type: TaskType = "image", annotationKind: AnnotationKind = "box") => {
    return createTask(projectId, name, type, annotationKind).then((task) => {
      setTasks((prev) => [{ ...task, imageCount: 0, annotationCount: 0 }, ...prev]);
      return task;
    });
  }, [projectId]);

  const removeTask = useCallback((id: string) => {
    return deleteTask(id).then(() => {
      setTasks((prev) => prev.filter((t) => t.id !== id));
    });
  }, []);

  const renameTask = useCallback((id: string, name: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name } : t))
    );
  }, []);

  const getTask = useCallback((id: string) => {
    return tasks.find((t) => t.id === id);
  }, [tasks]);

  return {
    tasks,
    loading,
    addTask,
    removeTask,
    renameTask,
    getTask,
    refreshTasks: loadTasks,
  };
};
