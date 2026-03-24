import { useState, useCallback } from "react";
import { Task, DEFAULT_CLASSES, AnnotationClass } from "@/types/annotation";

interface TaskWithCounts extends Task {
  imageCount: number;
  annotationCount: number;
}

export const useTasks = (projectId: string) => {
  const [tasks, setTasks] = useState<TaskWithCounts[]>([]);

  const addTask = useCallback((name: string) => {
    const task: Task = {
      id: crypto.randomUUID(),
      projectId,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setTasks((prev) => [{ ...task, imageCount: 0, annotationCount: 0 }, ...prev]);
    return task;
  }, [projectId]);

  const removeTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
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
    loading: false,
    addTask,
    removeTask,
    renameTask,
    getTask,
    refreshTasks: () => {},
  };
};
