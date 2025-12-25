import { useState, useCallback, useRef, useEffect } from "react";
import { useAnnotations } from "@/hooks/useAnnotations";
import { ImageData } from "@/types/annotation";
import { Toolbar } from "./Toolbar";
import { ClassPanel } from "./ClassPanel";
import { AnnotationList } from "./AnnotationList";
import { Canvas } from "./Canvas";
import { ImageUpload } from "./ImageUpload";
import { toast } from "sonner";

export const AnnotationTool = () => {
  const [image, setImage] = useState<ImageData | null>(null);
  const [tool, setTool] = useState<"select" | "draw">("draw");
  const importInputRef = useRef<HTMLInputElement>(null);

  const {
    annotations,
    classes,
    selectedClassId,
    selectedAnnotationId,
    setSelectedClassId,
    setSelectedAnnotationId,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAnnotations,
    addClass,
    deleteClass,
    exportToYOLO,
    importFromYOLO,
  } = useAnnotations();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key.toLowerCase()) {
        case "v":
          setTool("select");
          break;
        case "b":
          setTool("draw");
          break;
        case "delete":
        case "backspace":
          if (selectedAnnotationId) {
            deleteAnnotation(selectedAnnotationId);
          }
          break;
        case "escape":
          setSelectedAnnotationId(null);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAnnotationId, deleteAnnotation, setSelectedAnnotationId]);

  const handleExport = useCallback(() => {
    const content = exportToYOLO();
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = image ? image.name.replace(/\.[^/.]+$/, ".txt") : "annotations.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Annotations exported successfully");
  }, [exportToYOLO, image]);

  const handleImport = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          importFromYOLO(event.target?.result as string);
          toast.success(`Imported ${annotations.length} annotations`);
        } catch {
          toast.error("Failed to parse YOLO file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [importFromYOLO, annotations.length]
  );

  const handleClear = useCallback(() => {
    clearAnnotations();
    toast.info("All annotations cleared");
  }, [clearAnnotations]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">Y</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">YOLO Annotator</h1>
            <p className="text-xs text-muted-foreground">Image annotation for object detection</p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
        </div>
      </header>

      {/* Toolbar */}
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        onClear={handleClear}
        onExport={handleExport}
        onImport={handleImport}
        hasAnnotations={annotations.length > 0}
        hasImage={!!image}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
          <ImageUpload image={image} onImageLoad={setImage} />
          <ClassPanel
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClass={setSelectedClassId}
            onAddClass={addClass}
            onDeleteClass={deleteClass}
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground">Annotations</h3>
          </div>
          <AnnotationList
            annotations={annotations}
            classes={classes}
            selectedId={selectedAnnotationId}
            onSelect={setSelectedAnnotationId}
            onDelete={deleteAnnotation}
          />
        </aside>

        {/* Canvas */}
        <Canvas
          image={image}
          annotations={annotations}
          classes={classes}
          selectedClassId={selectedClassId}
          selectedAnnotationId={selectedAnnotationId}
          tool={tool}
          onAddAnnotation={addAnnotation}
          onUpdateAnnotation={updateAnnotation}
          onSelectAnnotation={setSelectedAnnotationId}
        />
      </div>

      {/* Hidden import input */}
      <input
        ref={importInputRef}
        type="file"
        accept=".txt"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Status bar */}
      <footer className="px-4 py-2 border-t border-border bg-card text-xs text-muted-foreground flex items-center gap-4">
        <span>
          Tool: <span className="text-foreground font-medium">{tool === "draw" ? "Draw Box" : "Select"}</span>
        </span>
        <span>|</span>
        <span>
          Class: <span className="text-foreground font-medium">{classes.find((c) => c.id === selectedClassId)?.name}</span>
        </span>
        <span>|</span>
        <span className="text-muted-foreground">
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">V</kbd> Select
          <span className="mx-2">•</span>
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">B</kbd> Draw
          <span className="mx-2">•</span>
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Del</kbd> Delete
        </span>
      </footer>
    </div>
  );
};
