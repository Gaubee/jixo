import {Button} from "@/components/ui/button.tsx";
import {cn} from "@/lib/utils.ts";
import {Check, Copy} from "lucide-react";
import React, {useState} from "react";

interface CopyCommandButtonProps {
  label?: string;
  command: string;
  className?: string;
}

export function CopyCommandButton({command, label = command, className}: CopyCommandButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className={cn("hover:bg-accent text-primary flex w-full items-start justify-between gap-2 bg-white p-2 text-left font-mono shadow-sm", className)}
    >
      <span className="truncate">{label}</span>
      {isCopied ? <Check className="h-4 w-4 flex-shrink-0 text-green-600" /> : <Copy className="h-4 w-4 flex-shrink-0" />}
    </Button>
  );
}
