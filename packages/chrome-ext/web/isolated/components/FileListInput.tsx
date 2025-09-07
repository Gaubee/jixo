import React, {useState} from "react";
import {Button} from "@/components/ui/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog.tsx";
import {LoaderCircle, X} from "lucide-react";

interface FileListInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  onBlur?: () => void;
  placeholder: string;
  onPreview: (patterns: string[]) => Promise<string[]>;
}

export function FileListInput({label, values, onChange, onBlur, placeholder, onPreview}: FileListInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [previewFiles, setPreviewFiles] = useState<string[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const handleAddItem = () => {
    if (inputValue.trim() && !values.includes(inputValue.trim())) {
      onChange([...values, inputValue.trim()]);
      setInputValue("");
    }
  };

  const handleRemoveItem = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddItem();
    }
  };

  const handlePreviewClick = async (patterns: string[]) => {
    if (patterns.length === 0) {
      setPreviewFiles([]);
      return;
    }
    setIsPreviewing(true);
    try {
      const files = await onPreview(patterns);
      setPreviewFiles(files);
    } catch (error) {
      console.error("Preview failed:", error);
      setPreviewFiles(["Error fetching files."]);
    } finally {
      setIsPreviewing(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        <Input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          placeholder={placeholder}
          className="flex-grow"
        />
        <Button type="button" onClick={handleAddItem} onBlur={onBlur} variant="secondary">
          Add
        </Button>
      </div>
      <div className="text-xs text-gray-500">
        {values.length > 0 ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="link" className="h-auto p-0 text-xs" onClick={() => handlePreviewClick(values)}>
                {isPreviewing ? <LoaderCircle className="mr-1 h-3 w-3 animate-spin" /> : null}
                Preview {values.length} selected path(s)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Matched Files for: {label}</DialogTitle>
              </DialogHeader>
              <div className="bg-muted max-h-60 space-y-1 overflow-y-auto rounded p-2 font-mono text-xs">
                {previewFiles.length > 0 ? previewFiles.map((file, index) => <p key={index}>{file}</p>) : <p>No files matched.</p>}
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          "No paths added."
        )}
      </div>
      <div className="max-h-24 space-y-1 overflow-y-auto pr-2">
        {values.map((value, index) => (
          <div key={index} className="bg-muted flex items-center justify-between rounded p-1 text-xs">
            <span className="ml-2 truncate font-mono">{value}</span>
            <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveItem(index)} onBlur={onBlur}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
