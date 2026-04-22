import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnnotationClass } from "@/types/annotation";

interface ClassPanelProps {
  classes: AnnotationClass[];
  selectedClassId: number | null;
  onSelectClass: (id: number) => void;
  onAddClass: (name: string) => void;
  onDeleteClass: (id: number) => void;
}

export const ClassPanel = ({
  classes,
  selectedClassId,
  onSelectClass,
  onAddClass,
  onDeleteClass,
}: ClassPanelProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newClassName, setNewClassName] = useState("");

  const handleAdd = () => {
    if (newClassName.trim()) {
      onAddClass(newClassName.trim());
      setNewClassName("");
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAdd();
    } else if (e.key === "Escape") {
      setIsAdding(false);
      setNewClassName("");
    }
  };

  return (
    <div className="p-3 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Classes</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="h-7 px-2"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
        {classes.map((cls) => (
          <div
            key={cls.id}
            onClick={() => onSelectClass(cls.id)}
            className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
              selectedClassId === cls.id
                ? "bg-primary/20 ring-1 ring-primary"
                : "hover:bg-secondary"
            }`}
          >
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ backgroundColor: cls.color }}
            />
            <span className="text-sm flex-1 truncate">{cls.name}</span>
            <span className="text-xs text-muted-foreground font-mono">{cls.id}</span>
            {classes.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClass(cls.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}

        {isAdding && (
          <div className="flex items-center gap-2 p-1">
            <Input
              autoFocus
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!newClassName.trim()) {
                  setIsAdding(false);
                }
              }}
              placeholder="Class name..."
              className="h-7 text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
};
