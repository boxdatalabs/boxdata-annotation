import { useState, useCallback } from "react";
import { Project } from "@/types/annotation";

interface ProjectWithCounts extends Project {
  taskCount: number;
}

export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);

  const addProject = useCallback((name: string, description?: string) => {
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProjects((prev) => [{ ...project, taskCount: 0 }, ...prev]);
    return project;
  }, []);

  const removeProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const renameProject = useCallback((id: string, name: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p))
    );
  }, []);

  const getProject = useCallback((id: string) => {
    return projects.find((p) => p.id === id);
  }, [projects]);

  const incrementTaskCount = useCallback((projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, taskCount: p.taskCount + 1 } : p))
    );
  }, []);

  const decrementTaskCount = useCallback((projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, taskCount: Math.max(0, p.taskCount - 1) } : p))
    );
  }, []);

  return {
    projects,
    loading: false,
    addProject,
    removeProject,
    renameProject,
    getProject,
    incrementTaskCount,
    decrementTaskCount,
  };
};
