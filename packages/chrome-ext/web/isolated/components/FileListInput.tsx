import React, {useState} from "react";

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

  const showPreview = () => {
    alert(`${label} paths:\n\n${values.join("\n")}`);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-grow block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm"
        />
        <button onClick={handleAddItem} className="px-4 py-2 bg-gray-200 rounded text-sm hover:bg-gray-300">
          Add
        </button>
      </div>
      <div className="text-xs text-gray-500">
        {values.length > 0 ? (
          <button onClick={showPreview} className="text-blue-500 hover:underline">
            Preview {values.length} selected path(s)
          </button>
        ) : (
          "No paths added."
        )}
      </div>
      <div className="space-y-1 max-h-24 overflow-y-auto">
        {values.map((value, index) => (
          <div key={index} className="flex items-center justify-between bg-gray-100 p-1 rounded text-xs">
            <span className="font-mono truncate">{value}</span>
            <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 ml-2 px-1">
              &times;
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
