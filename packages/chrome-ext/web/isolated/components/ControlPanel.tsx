import {useDebounce} from "@uidotdev/usehooks";
import React, {memo, useEffect, useState} from "react";
import type {MainContentScriptAPI} from "../../main/lib/content-script-api";
import {ConfigPanel} from "./ConfigPanel.tsx";
import * as Comlink from 'comlink'
import type { AgentMetadata } from "@jixo/dev/browser";

interface ControlPanelProps {
  workspaceName: string;
  mainApi:  Comlink.Remote<MainContentScriptAPI>;
  onGenerateConfig: (metadata: AgentMetadata) => Promise<any>;
  onApplyTemplate: () => Promise<{status: string; message?: string}>;
  onApplyConfig: () => Promise<{status: string; message?: string}>;
  onStartSync: () => Promise<{status: string; message?: string}>;
}

const initialMetadata: AgentMetadata = {
  agent: "coder",
  dirs: [],
  docs: [],
  mcp: [],
};

export function ControlPanel({workspaceName, mainApi, onGenerateConfig, onApplyTemplate, onApplyConfig, onStartSync}: ControlPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [metadata, setMetadata] = useState<AgentMetadata>(initialMetadata);
  const [configDiffers, setConfigDiffers] = useState(false);

  // Load initial metadata from config.json
  useEffect(() => {
    mainApi
      .readConfigFile(false)
      .then((config) => {
        if (config?.metadata) {
          setMetadata(config.metadata);
        }
      })
      .catch(() => {
        // Ignore if file doesn't exist
      });
  }, [mainApi]);

  // Periodically check for differences between config and template
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [config, template] = await Promise.all([mainApi.readConfigFile(false), mainApi.readConfigFile(true)]);
        // Also check if template exists
        setConfigDiffers(!!template && JSON.stringify(config) !== JSON.stringify(template));
      } catch {
        setConfigDiffers(false);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [mainApi]);

  const debouncedWriteMetadata = async (newMetadata: AgentMetadata) => {
    try {
      const currentConfig = (await mainApi.readConfigFile(false)) || {};
      await mainApi.writeConfigFile({...currentConfig, metadata: newMetadata}, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save metadata.");
    }
  };

  const handleMetadataChange = (newMetadata: AgentMetadata) => {
    setMetadata(newMetadata);
    debouncedWriteMetadata(newMetadata);
  };

  const handleGenerateConfig = async () => {
    setStatus("Generating template...");
    setError(null);
    try {
      await onGenerateConfig(metadata);
      setStatus("Template generated successfully!");
    } catch (err) {
      setStatus("Error generating template.");
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    }
  };

  const handleApplyTemplate = async () => {
    setStatus("Applying template to config...");
    setError(null);
    try {
      await onApplyTemplate();
      setStatus("Template applied to config!");
    } catch (err) {
      setStatus("Error applying template.");
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    }
  };

  const handleApplyConfig = async () => {
    setStatus("Applying config to page...");
    setError(null);
    try {
      await onApplyConfig();
      setStatus("Config applied to page successfully!");
    } catch (err) {
      setStatus("Error applying config to page.");
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    }
  };

  const handleStartSync = async () => {
    setStatus("Starting sync...");
    setError(null);
    try {
      await onStartSync();
      setStatus("Sync started.");
    } catch (err) {
      setStatus("Error starting sync.");
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    }
  };

  return (
    <div className="p-4 space-y-4 text-sm">
      <div className="p-2 border rounded bg-gray-50">
        <strong>Workspace:</strong> <code className="ml-2 bg-gray-200 px-1 rounded">{workspaceName}</code>
      </div>
      <ConfigPanel metadata={metadata} onMetadataChange={handleMetadataChange} />
      <div className="space-y-3 pt-3 border-t">
        <button onClick={handleStartSync} className="w-full p-2 bg-cyan-600 text-white rounded hover:bg-cyan-700">
          Start Page Sync
        </button>
        <button onClick={handleGenerateConfig} className="w-full p-2 bg-green-600 text-white rounded hover:bg-green-700">
          Generate Config Template
        </button>
        <button
          onClick={handleApplyTemplate}
          className="w-full p-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          disabled={!configDiffers}
        >
          Apply Template to Config
        </button>
        <button onClick={handleApplyConfig} className="w-full p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
          Apply Config to Page
        </button>
      </div>
      {status && <p className="text-xs text-gray-500 mt-1">{status}</p>}
      {error && <p className="text-sm text-red-500 mt-2 p-2 bg-red-50 rounded border border-red-200">{error}</p>}
    </div>
  );
}
