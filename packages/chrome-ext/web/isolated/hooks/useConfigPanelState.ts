import {isEqualCanonical} from "@/lib/utils.ts";
import {zodResolver} from "@hookform/resolvers/zod";
import type {AgentMetadata, PageConfig} from "@jixo/dev/browser";
import {KeyValStore} from "@jixo/dev/idb-keyval";
import {useDebounce} from "@uidotdev/usehooks";
import {useCallback, useContext, useEffect, useState} from "react";
import {useForm} from "react-hook-form";
import {z} from "zod";
import {IsolatedAPICtx, MainAPICtx, SessionAPICtx, SessionIdCtx} from "../components/context.ts";
import {useNotification} from "../components/Notification.tsx";

const agentConfigStore = new KeyValStore<PageConfig>("agent-config");

const AgentFormSchema = z.object({
  metadata: z.object({
    workDir: z.string().min(1, "Workspace directory is required."),
    agent: z.literal("coder"),
    codeName: z.string().optional(),
    dirs: z.array(z.string()).optional(),
    docs: z.array(z.string()).optional(),
    mcp: z
      .array(
        z.object({
          command: z.string(),
          prefix: z.string().optional(),
        }),
      )
      .optional(),
    tools: z
      .object({
        exclude: z.array(z.string()).optional(),
      })
      .optional(),
  }),
});

export type AgentFormValues = z.infer<typeof AgentFormSchema>;

const initialMetadata: AgentMetadata = {
  agent: "coder",
  codeName: "",
  workDir: "",
  dirs: [],
  docs: [],
  mcp: [],
  tools: {
    exclude: [],
  },
};

const initialConfig: PageConfig = {
  metadata: initialMetadata,
  model: "",
  systemPrompt: "",
  tools: [],
};

export type WorkspaceStatus = "missing_handle" | "linking_required" | "ready";

export function useConfigPanelState() {
  const mainApi = useContext(MainAPICtx);
  const isolatedApi = useContext(IsolatedAPICtx);
  const sessionApi = useContext(SessionAPICtx);
  const sessionId = useContext(SessionIdCtx);
  const {addNotification} = useNotification();

  // --- Core State ---
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>("missing_handle");
  const [activeConfig, setActiveConfig] = useState<PageConfig>(initialConfig);
  const [stagedConfig, setStagedConfig] = useState<PageConfig>(initialConfig);
  const [isDirty, setIsDirty] = useState(false);

  // --- UI Helper State ---
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [nid, setNid] = useState<number>();

  const stagedConfigKey = `staged-config-${sessionId}`;
  const debouncedStagedMetadata = useDebounce(stagedConfig.metadata, 300);

  const form = useForm<AgentFormValues>({
    resolver: zodResolver(AgentFormSchema),
    defaultValues: {metadata: initialMetadata},
  });

  // --- Workspace Status Machine ---
  const checkWorkspaceStatus = useCallback(async () => {
    const handleName = await mainApi.getWorkspaceHandleName();
    setWorkspaceName(handleName);

    if (!handleName) {
      setWorkspaceStatus("missing_handle");
      return;
    }

    const configFile = await mainApi.readConfigFile(sessionId);
    if (!configFile) {
      setWorkspaceStatus("linking_required");
      // Wait for user to link via terminal
      const workDir = await sessionApi.whenWorkDirChanged();
      // Once linked, the local service will have the workDir.
      // We can now treat it as ready, which will trigger the data loading effect.
      // We also need to ensure the backend session has the dir.
      setWorkspaceStatus("ready");
    } else {
      await sessionApi.setWorkDir(configFile.metadata!.workDir);
      setWorkspaceStatus("ready");
    }
  }, [mainApi, sessionId, sessionApi]);

  useEffect(() => {
    checkWorkspaceStatus();
    sessionApi.nid.then(setNid);
  }, [checkWorkspaceStatus, sessionApi]);

  // --- Data Loading Effect (runs when workspace is ready) ---
  useEffect(() => {
    if (workspaceStatus !== "ready") {
      // Reset state if workspace is not ready, preventing stale data
      setActiveConfig(initialConfig);
      setStagedConfig(initialConfig);
      form.reset({metadata: initialConfig.metadata});
      return;
    }

    const controller = new AbortController();
    const {signal} = controller;

    const syncState = async () => {
      try {
        const [active, staged] = await Promise.all([mainApi.readConfigFile(sessionId), agentConfigStore.get(stagedConfigKey)]);
        if (signal.aborted) return;

        // If 'active' is null, it means we just linked. We need to create the initial config.
        let finalActive: PageConfig;
        if (!active) {
          const workDir = await sessionApi.getWorkDir();
          finalActive = structuredClone(initialConfig);
          finalActive.metadata!.workDir = workDir;
          // Write the initial config file
          await mainApi.writeConfigFile(sessionId, JSON.stringify(finalActive, null, 2));
        } else {
          finalActive = active;
        }

        setActiveConfig(finalActive);
        setStagedConfig(staged || finalActive);
        form.reset({metadata: (staged || finalActive).metadata});
      } catch (err) {
        addNotification({type: "error", message: "Failed to load configuration."});
      }
    };

    syncState();
    return () => controller.abort();
  }, [workspaceStatus, sessionId, mainApi, sessionApi, addNotification]);

  // --- Dirty State Calculation Effect ---
  useEffect(() => {
    if (workspaceStatus !== "ready") {
      setIsDirty(false);
      return;
    }

    const calculateDirtiness = async () => {
      if (!stagedConfig.metadata?.workDir) {
        setIsDirty(false);
        return;
      }

      // Optimization: First, do a cheap comparison of the metadata objects.
      const metadataIsDirty = !isEqualCanonical(activeConfig.metadata, stagedConfig.metadata);
      if (metadataIsDirty) {
        setIsDirty(true);
        return; // We know it's dirty, no need for an expensive API call.
      }

      // If metadata is the same, we need to do the expensive check to see if
      // the generated content (like systemPrompt) has changed due to external factors.
      setIsGenerating(true);
      try {
        const previewConfig = await isolatedApi.generateConfigFromMetadata(sessionId, stagedConfig.metadata);
        const newIsDirty = !isEqualCanonical(activeConfig, {...previewConfig, metadata: stagedConfig.metadata});
        setIsDirty(newIsDirty);
      } catch (e) {
        // If generation fails, assume it's not dirty to be safe.
        setIsDirty(false);
      } finally {
        setIsGenerating(false);
      }
    };

    calculateDirtiness();
  }, [stagedConfig, activeConfig, workspaceStatus, isolatedApi, sessionId]);

  // --- Event Handlers ---
  const handleSelectWorkspace = useCallback(async () => {
    setIsSelecting(true);
    try {
      await mainApi.updateWorkspaceHandle();
      void checkWorkspaceStatus(); // Re-check status after selection
    } finally {
      setIsSelecting(false);
    }
  }, [mainApi, checkWorkspaceStatus]);

  const handleApplyChanges = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!stagedConfig.metadata) {
        throw new Error("Cannot apply changes, metadata is missing.");
      }
      // 1. Generate the final config based on the staged metadata
      const finalConfig = await isolatedApi.generateConfigFromMetadata(sessionId, stagedConfig.metadata);

      // 2. Write the final config to the file system
      await mainApi.writeConfigFile(sessionId, JSON.stringify(finalConfig, null, 2));

      // 3. Apply the config to the AI Studio page
      await mainApi.applyConfigFile(sessionId);

      // 4. Clean up the staged config from IndexedDB
      await agentConfigStore.del(stagedConfigKey);

      // 5. **CRITICAL FIX**: Directly update the in-memory state to match the new reality
      setActiveConfig(finalConfig);
      setStagedConfig(finalConfig);
      form.reset({metadata: finalConfig.metadata}); // Also reset the form
      setIsDirty(false); // 立即响应界面状态

      addNotification({type: "success", message: "Configuration applied successfully."});
    } catch (err) {
      addNotification({type: "error", message: err instanceof Error ? err.message : "Failed to apply changes."});
    } finally {
      setIsLoading(false);
    }
  }, [stagedConfig, isolatedApi, mainApi, sessionId, stagedConfigKey, addNotification]);

  const handleCancelChanges = useCallback(async () => {
    await agentConfigStore.del(stagedConfigKey);
    setStagedConfig(activeConfig);
    form.reset({metadata: activeConfig.metadata});
    addNotification({type: "info", message: "Changes have been discarded."});
  }, [activeConfig, stagedConfigKey, addNotification]);

  const handlePreview = (patterns: string[]) => {
    return sessionApi.globFiles(patterns);
  };

  // --- Form Subscription ---
  useEffect(() => {
    const subscription = form.watch((value) => {
      setStagedConfig((prev) => ({...prev, metadata: value.metadata as AgentMetadata}));
    });
    return () => subscription.unsubscribe();
  }, [form.watch]);

  const command1 = `deno run -A jsr:@jixo/cli/session ${nid}`;
  const command2 = `deno eval "await fetch('http://localhost:8765/init-session?nid=${nid}&workDir='+Deno.cwd())"`;

  return {
    form,
    workspaceStatus,
    workspaceName,
    isSelecting,
    nid,
    command1,
    command2,
    stagedConfig,
    isDirty,
    isGenerating,
    isLoading,
    handleApplyChanges,
    handleCancelChanges,
    handlePreview,
    handleSelectWorkspace,
  };
}

export type ConfigPanelState = ReturnType<typeof useConfigPanelState>;
