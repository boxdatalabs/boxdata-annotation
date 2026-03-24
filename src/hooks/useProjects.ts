import { useState, useEffect, useCallback } from "react";
import { Project } from "@/types/annotation";
import { getAllProjects, createProject, deleteProject, updateProject, getProjectTaskCount } from "@/lib/db";

interface ProjectWithCounts extends Project {
  taskCount: number;
}

export const useProjects = () => {
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const allProjects = await getAllProjects();
      const projectsWithCounts = await Promise.all(
        allProjects.map(async (project) => ({
          ...project,
          taskCount: await getProjectTaskCount(project.id),
        }))
      );
      setProjects(projectsWithCounts);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const addProject = useCallback(async (name: string, description?: string) => {
    const project = await createProject(name, description);
    setProjects((prev) => [{ ...project, taskCount: 0 }, ...prev]);
    return project;
  }, []);

  const removeProject = useCallback(async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const renameProject = useCallback(async (id: string, name: string) => {
    await updateProject(id, { name });
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p))
    );
  }, []);

  return {
    projects,
    loading,
    addProject,
    removeProject,
    renameProject,
    refreshProjects: loadProjects,
  };
};
