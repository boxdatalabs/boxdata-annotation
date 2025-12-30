import { useState, useEffect, useCallback } from "react";
import { Task } from "@/types/annotation";
import { getAllTasks, createTask, deleteTask, updateTask, getTaskImageCount, getTaskAnnotationCount } from "@/lib/db";

interface TaskWithCounts extends Task {
  imageCount: number;
  annotationCount: number;
}

export const useTasks = () => {
  const [tasks, setTasks] = useState<TaskWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const allTasks = await getAllTasks();
      const tasksWithCounts = await Promise.all(
        allTasks.map(async (task) => ({
          ...task,
          imageCount: await getTaskImageCount(task.id),
          annotationCount: await getTaskAnnotationCount(task.id),
        }))
      );
      setTasks(tasksWithCounts);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const addTask = useCallback(async (name: string) => {
    const task = await createTask(name);
    setTasks((prev) => [{ ...task, imageCount: 0, annotationCount: 0 }, ...prev]);
    return task;
  }, []);

  const removeTask = useCallback(async (id: string) => {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const renameTask = useCallback(async (id: string, name: string) => {
    await updateTask(id, { name });
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name } : t))
    );
  }, []);

  return {
    tasks,
    loading,
    addTask,
    removeTask,
    renameTask,
    refreshTasks: loadTasks,
  };
};