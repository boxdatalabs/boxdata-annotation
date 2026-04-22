import { useState, useCallback, useEffect } from "react";
import { Project } from "@/types/annotation";
import { createProject, deleteProject, getAllProjects, getProjectTaskCount } from "@/lib/db";

interface ProjectWithCounts extends Project {
  taskCount: number;
}

export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const storedProjects = await getAllProjects();
      const projectsWithCounts = await Promise.all(
        storedProjects.map(async (project) => ({
          ...project,
          taskCount: await getProjectTaskCount(project.id),
        }))
      );
      setProjects(projectsWithCounts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const addProject = useCallback((name: string, description?: string) => {
    return createProject(name, description).then((project) => {
      setProjects((prev) => [{ ...project, taskCount: 0 }, ...prev]);
      return project;
    });
  }, []);

  const removeProject = useCallback((id: string) => {
    return deleteProject(id).then(() => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    });
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
    loading,
    addProject,
    removeProject,
    renameProject,
    getProject,
    incrementTaskCount,
    decrementTaskCount,
  };
};
