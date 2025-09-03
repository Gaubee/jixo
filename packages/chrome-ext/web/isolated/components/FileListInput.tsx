import React, {useState} from "react";
import {Button} from "@/components/ui/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger} from "@/components/ui/dialog.tsx";
import {X} from "lucide-react";

interface FileListInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}

export function FileListInput({label, values, onChange, placeholder}: FileListInputProps) {
  const [inputValue, setInputValue] = useState("");

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

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        <Input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleKeyDown} placeholder={placeholder} className="flex-grow" />
        <Button onClick={handleAddItem} variant="secondary">
          Add
        </Button>
      </div>
      <div className="text-xs text-gray-500">
        {values.length > 0 ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="link" className="p-0 h-auto text-xs">
                Preview {values.length} selected path(s)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{label} Paths</DialogTitle>
              </DialogHeader>
              <div className="max-h-60 overflow-y-auto font-mono text-xs space-y-1">
                {values.map((value, index) => (
                  <p key={index}>{value}</p>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          "No paths added."
        )}
      </div>
      <div className="space-y-1 max-h-24 overflow-y-auto pr-2">
        {values.map((value, index) => (
          <div key={index} className="flex items-center justify-between bg-muted p-1 rounded text-xs">
            <span className="font-mono truncate ml-2">{value}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleRemoveItem(index)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
