import { Trash2 } from "lucide-react";
import { BoundingBox, AnnotationClass } from "@/types/annotation";

interface AnnotationListProps {
  annotations: BoundingBox[];
  classes: AnnotationClass[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export const AnnotationList = ({
  annotations,
  classes,
  selectedId,
  onSelect,
  onDelete,
}: AnnotationListProps) => {
  const fallbackClass: AnnotationClass = {
    id: -1,
    name: "Unassigned",
    color: "hsl(var(--muted-foreground))",
  };

  const getClass = (classId: number) => {
    return classes.find((c) => c.id === classId) || classes[0] || fallbackClass;
  };

  if (annotations.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        <p>No annotations yet</p>
        <p className="text-xs mt-1">Draw boxes on the image</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="p-3 space-y-1.5">
        {annotations.map((ann, index) => {
          const cls = getClass(ann.classId);
          const kind = ann.kind ?? "box";
          const coordLabel =
            kind === "box"
              ? `${(ann.x ?? 0).toFixed(3)}, ${(ann.y ?? 0).toFixed(3)}`
              : `${(ann.points?.length ?? 0)} pts`;
          return (
            <div
              key={ann.id}
              onClick={() => onSelect(ann.id)}
              className={`group flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition-all ${
                selectedId === ann.id
                  ? "bg-primary/20 ring-1 ring-primary"
                  : "hover:bg-secondary"
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: cls.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{cls.name}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  <span className="uppercase mr-1">{kind}</span>
                  {coordLabel}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">#{index + 1}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(ann.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
