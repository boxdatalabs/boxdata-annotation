import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTaskAnnotations } from "@/hooks/useTaskAnnotations";
import { AnnotationKind, Task } from "@/types/annotation";
import { getTask, updateTask } from "@/lib/db";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Toolbar } from "./Toolbar";
import { ClassPanel } from "./ClassPanel";
import { AnnotationList } from "./AnnotationList";
import { Canvas } from "./Canvas";
import { ImageUpload } from "./ImageUpload";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import JSZip from "jszip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { detectTextRegions, getGeminiApiKey } from "@/services/geminiOCR";

export const TaskAnnotationTool = () => {
  const { taskId, projectId } = useParams<{ taskId: string; projectId: string }>();
  const navigate = useNavigate();
  const [tool, setTool] = useState<"select" | "draw">("draw");
  const [isAutoAnnotating, setIsAutoAnnotating] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!taskId) return;
    void getTask(taskId).then((t) => setTask(t ?? null));
  }, [taskId]);

  const annotationKind: AnnotationKind = (task?.annotationKind as AnnotationKind) ?? "box";

  const {
    images,
    currentImage,
    currentImageIndex,
    annotations,
    imageAnnotations,
    classes,
    selectedClassId,
    selectedAnnotationId,
    loading,
    setCurrentImageIndex,
    setSelectedClassId,
    setSelectedAnnotationId,
    addImages,
    removeImage,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    clearAnnotations,
    addClass,
    deleteClass,
    exportToYOLO,
    exportToJSON,
    importFromYOLO,
    getAnnotationCount,
    getTotalAnnotations,
    getAnnotatedImagesCount,
    getImageBlob,
  } = useTaskAnnotations(taskId || "");


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
        case "arrowleft":
          if (currentImageIndex > 0) {
            setCurrentImageIndex(currentImageIndex - 1);
          }
          break;
        case "arrowright":
          if (currentImageIndex < images.length - 1) {
            setCurrentImageIndex(currentImageIndex + 1);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAnnotationId, deleteAnnotation, setSelectedAnnotationId, currentImageIndex, images.length, setCurrentImageIndex]);

  const runExport = useCallback(async (format: "yolo" | "json") => {
    if (images.length === 0) {
      toast.error("No images to export");
      return;
    }
    const annotatedImages = images.filter((img) => (imageAnnotations[img.id] || []).length > 0);
    if (annotatedImages.length === 0) {
      toast.error("No annotations to export");
      return;
    }

    const zip = new JSZip();
    const jsonItems: unknown[] = [];

    for (let i = 0; i < annotatedImages.length; i++) {
      const image = annotatedImages[i];
      const baseName = `${i + 1}`;
      const ext = image.name.split(".").pop()?.toLowerCase() || "png";

      const blob = await getImageBlob(image.id);
      if (blob) zip.file(`${baseName}.${ext}`, blob);

      if (format === "yolo") {
        zip.file(`${baseName}.txt`, exportToYOLO(image.id));
      } else {
        jsonItems.push(exportToJSON(image.id, image.name, image.width, image.height));
      }
    }

    if (format === "yolo") {
      zip.file("classes.txt", classes.map((c) => c.name).join("\n"));
    } else {
      zip.file(
        "annotations.json",
        JSON.stringify(
          {
            kind: annotationKind,
            classes: classes.map((c) => ({ id: c.id, name: c.name })),
            images: jsonItems,
          },
          null,
          2
        )
      );
    }

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `annotations_${format}.zip`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${annotatedImages.length} images (${format.toUpperCase()})`);
  }, [images, imageAnnotations, exportToYOLO, exportToJSON, classes, getImageBlob, annotationKind]);

  const handleExport = useCallback(() => {
    if (images.length === 0) {
      toast.error("No images to export");
      return;
    }
    setExportDialogOpen(true);
  }, [images.length]);

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
          toast.success("Annotations imported successfully");
        } catch {
          toast.error("Failed to parse YOLO file");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [importFromYOLO]
  );

  const handleClear = useCallback(() => {
    clearAnnotations();
    toast.info("Annotations cleared for current image");
  }, [clearAnnotations]);

  const handleAutoAnnotate = useCallback(async () => {
    if (!currentImage) {
      toast.error("No image selected");
      return;
    }

    if (selectedClassId === null) {
      toast.error("Create a class first");
      return;
    }

    if (!getGeminiApiKey()) {
      toast.error("Please configure your Gemini API key first (click the settings icon)");
      return;
    }

    setIsAutoAnnotating(true);
    try {
      const boxes = await detectTextRegions(currentImage.src, selectedClassId);
      
      if (boxes.length === 0) {
        toast.info("No text regions detected in this image");
      } else {
        boxes.forEach(box => addAnnotation(box));
        toast.success(`Detected ${boxes.length} text region${boxes.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to auto-annotate");
    } finally {
      setIsAutoAnnotating(false);
    }
  }, [currentImage, selectedClassId, addAnnotation]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading task...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/project/${projectId}`)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">Y</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Task</h1>
            <p className="text-xs text-muted-foreground capitalize">{annotationKind} annotation</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Type:</span>
            <Select
              value={annotationKind}
              onValueChange={async (v) => {
                if (!taskId) return;
                const kind = v as AnnotationKind;
                await updateTask(taskId, { annotationKind: kind });
                setTask((prev) => (prev ? { ...prev, annotationKind: kind } : prev));
                toast.success(`Switched to ${kind}`);
              }}
            >
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="box">Bounding Box</SelectItem>
                <SelectItem value="polygon">Polygon</SelectItem>
                <SelectItem value="polyline">Polyline</SelectItem>
                <SelectItem value="point">Point</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-4">
            <span>
              {getAnnotatedImagesCount()}/{images.length} images annotated
            </span>
            <span>•</span>
            <span>{getTotalAnnotations()} total annotations</span>
          </div>
        </div>
      </header>



      {/* Toolbar */}
      <Toolbar
        tool={tool}
        onToolChange={setTool}
        onClear={handleClear}
        onExport={handleExport}
        onImport={handleImport}
        onAutoAnnotate={handleAutoAnnotate}
        isAutoAnnotating={isAutoAnnotating}
        hasAnnotations={annotations.length > 0}
        hasImage={!!currentImage}
        annotationKind={annotationKind}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
          <ImageUpload
            images={images}
            currentImageIndex={currentImageIndex}
            onImagesLoad={addImages}
            onImageSelect={setCurrentImageIndex}
            onImageRemove={removeImage}
            getAnnotationCount={getAnnotationCount}
          />
          <ClassPanel
            classes={classes}
            selectedClassId={selectedClassId}
            onSelectClass={setSelectedClassId}
            onAddClass={addClass}
            onDeleteClass={deleteClass}
          />
          <div className="flex items-center justify-between px-3 py-2 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground">Annotations</h3>
            <span className="text-xs text-muted-foreground">{annotations.length}</span>
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
          image={currentImage}
          annotations={annotations}
          classes={classes}
          selectedClassId={selectedClassId}
          selectedAnnotationId={selectedAnnotationId}
          tool={tool}
          annotationKind={annotationKind}
          onAddAnnotation={addAnnotation}
          onUpdateAnnotation={updateAnnotation}
          onSelectAnnotation={setSelectedAnnotationId}
        />
      </div>

      {/* Export format dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose export format</DialogTitle>
            <DialogDescription>
              Pick the format for your annotations. Both export images plus annotation files in a ZIP.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <button
              onClick={() => { setExportDialogOpen(false); void runExport("yolo"); }}
              className="flex flex-col items-start gap-2 p-4 rounded-lg border-2 border-border hover:border-primary transition-colors text-left"
            >
              <p className="font-semibold text-foreground">YOLO (.txt)</p>
              <p className="text-xs text-muted-foreground">
                Boxes, polygon segmentation, and keypoints in YOLO text format. Includes classes.txt.
              </p>
            </button>
            <button
              onClick={() => { setExportDialogOpen(false); void runExport("json"); }}
              className="flex flex-col items-start gap-2 p-4 rounded-lg border-2 border-border hover:border-primary transition-colors text-left"
            >
              <p className="font-semibold text-foreground">JSON (COCO-style)</p>
              <p className="text-xs text-muted-foreground">
                Single annotations.json with all shapes (box, polygon, polyline, point) per image.
              </p>
            </button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportDialogOpen(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden import input */}
      <input ref={importInputRef} type="file" accept=".txt" onChange={handleImportFile} className="hidden" />

      {/* Status bar */}
      <footer className="px-4 py-2 border-t border-border bg-card text-xs text-muted-foreground flex items-center gap-4">
        <span>
          Tool: <span className="text-foreground font-medium capitalize">{tool === "draw" ? `Draw ${annotationKind}` : "Select"}</span>
        </span>
        <span>|</span>
        <span>
          Class:{" "}
          <span className="text-foreground font-medium">
            {classes.find((c) => c.id === selectedClassId)?.name ?? "Create a class"}
          </span>
        </span>
        {currentImage && (
          <>
            <span>|</span>
            <span>
              Image:{" "}
              <span className="text-foreground font-medium">
                {currentImageIndex + 1}/{images.length}
              </span>
            </span>
          </>
        )}
        <span>|</span>
        <span className="text-muted-foreground">
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">←</kbd>
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs ml-0.5">→</kbd> Navigate
          <span className="mx-2">•</span>
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