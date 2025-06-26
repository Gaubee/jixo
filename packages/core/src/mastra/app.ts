import {Mastra, type Config} from "@mastra/core";
import {LibSQLStore} from "@mastra/libsql";
import {PinoLogger, type LogLevel} from "@mastra/loggers";
import {mkdirSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import type {CreateAgentOptions} from "./agent/common.js";
import {createConciergeAgent, type ConciergeAgent} from "./agent/concierge.js";
import {createExecutorAgent, createPlannerAgent, createReviewerAgent, type ExecutorAgent, type PlannerAgent, type ReviewerAgent} from "./agent/index.js";
import {middleware} from "./server/middleware/index.js";
import {routes} from "./server/routes/index.js";
import {WorkspaceManager} from "./services/workspaceManager.js";
import {jixoJobWorkflow, type JixoJobWorkflow} from "./workflows/jixoJobWorkflow.js";
import {jixoMasterWorkflow, type JixoMasterWorkflow} from "./workflows/jixoMasterWorkflow.js";

export type CreateJixoAppOptions = {
  appName?: string;
  workspaceDir: string;
  logLevel?: LogLevel;
  otlpEndpoint?: string;
};
/**
 * Config<
 *  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
 *  TLegacyWorkflows extends Record<string, LegacyWorkflow> = Record<string, LegacyWorkflow>,
 *  TWorkflows extends Record<string, Workflow> = Record<string, Workflow>,
 *  TVectors extends Record<string, MastraVector> = Record<string, MastraVector>,
 *  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
 *  TLogger extends IMastraLogger = IMastraLogger,
 *  TNetworks extends Record<string, AgentNetwork> = Record<string, AgentNetwork>,
 *  TVNextNetworks extends Record<string, NewAgentNetwork> = Record<string, NewAgentNetwork>,
 *  TMCPServers extends Record<string, MCPServerBase> = Record<string, MCPServerBase>
 * >
 */

export type JixoAppConfig = Config & {
  workspaceManager: WorkspaceManager;
  /* TAgents: */ agents: {
    plannerAgent: PlannerAgent;
    executorAgent: ExecutorAgent;
    reviewerAgent: ReviewerAgent;
    conciergeAgent: ConciergeAgent;
  };
  // /* TLegacyWorkflows: */ legacy_workflows: NonNullable<Config["legacy_workflows"]>;
  /* TWorkflows: */ workflows: {
    jixoJobWorkflow: JixoJobWorkflow;
    jixoMasterWorkflow: JixoMasterWorkflow;
  };
  // /* TVectors: */ vectors: NonNullable<Config["vectors"]>;
  // /* TTTS: */ tts: NonNullable<Config["tts"]>;
  /* TLogger: */ logger: PinoLogger;
  // /* TNetworks: */ networks: NonNullable<Config["networks"]>;
  // /* TVNextNetworks: */ vnext_networks: NonNullable<Config["vnext_networks"]>;
  // /* TMCPServers: */ mcpServers: NonNullable<Config["mcpServers"]>;
};

/**
 * Mastra<
 *  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
 *  TLegacyWorkflows extends Record<string, LegacyWorkflow> = Record<string, LegacyWorkflow>,
 *  TWorkflows extends Record<string, Workflow> = Record<string, Workflow>,
 *  TVectors extends Record<string, MastraVector> = Record<string, MastraVector>,
 *  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
 *  TLogger extends IMastraLogger = IMastraLogger,
 *  TNetworks extends Record<string, AgentNetwork> = Record<string, AgentNetwork>,
 *  TVNextNetworks extends Record<string, NewAgentNetwork> = Record<string, NewAgentNetwork>,
 *  TMCPServers extends Record<string, MCPServerBase> = Record<string, MCPServerBase>
 * >
 */
export class JixoApp extends Mastra<
  /* TAgents: */ JixoAppConfig["agents"],
  /* TLegacyWorkflows: */ NonNullable<JixoAppConfig["legacy_workflows"]>,
  /* TWorkflows: */ JixoAppConfig["workflows"],
  /* TVectors: */ NonNullable<JixoAppConfig["vectors"]>,
  /* TTTS: */ NonNullable<JixoAppConfig["tts"]>,
  /* TLogger: */ JixoAppConfig["logger"],
  /* TNetworks: */ NonNullable<JixoAppConfig["networks"]>,
  /* TVNextNetworks: */ NonNullable<JixoAppConfig["vnext_networks"]>,
  /* TMCPServers: */ NonNullable<JixoAppConfig["mcpServers"]>
> {
  public readonly workspaceManager: WorkspaceManager;

  constructor(config: JixoAppConfig & {workspaceManager: WorkspaceManager}) {
    super(config);
    this.workspaceManager = config.workspaceManager;
  }
}

export const jixoAppConfigFactory = async ({appName = "JIXO", workspaceDir, logLevel, otlpEndpoint = "http://localhost:4318"}: CreateJixoAppOptions) => {
  const memoryFilepath = path.join(workspaceDir, ".jixo/memory/shared.db");
  mkdirSync(path.dirname(memoryFilepath), {recursive: true});
  const memoryStorage = new LibSQLStore({
    url: pathToFileURL(memoryFilepath).href,
  });
  const opts: CreateAgentOptions = {jobDir: workspaceDir, memoryStorage};
  const logger = new PinoLogger({
    name: appName,
    level: logLevel,
  });
  const workspaceManager = new WorkspaceManager(workspaceDir);

  return {
    agents: {
      plannerAgent: await createPlannerAgent(opts),
      executorAgent: await createExecutorAgent(opts),
      reviewerAgent: await createReviewerAgent(opts),
      conciergeAgent: await createConciergeAgent(opts),
    },
    workflows: {
      jixoJobWorkflow,
      jixoMasterWorkflow,
    },
    storage: memoryStorage,
    logger: logger,
    workspaceManager,
    telemetry:
      otlpEndpoint &&
      (await fetch(otlpEndpoint).then(
        () => true,
        () => false,
      ))
        ? {
            serviceName: appName,
            enabled: true,
            export: {
              type: "otlp",
              endpoint: otlpEndpoint,
            },
          }
        : void 0,
    server: {
      middleware: middleware,
      apiRoutes: routes,
    },
  } satisfies JixoAppConfig;
};

export const createJixoApp = async ({appName = "JIXO", workspaceDir, logLevel, otlpEndpoint}: CreateJixoAppOptions): Promise<JixoApp> => {
  const config = await jixoAppConfigFactory({appName, workspaceDir, logLevel, otlpEndpoint});
  return new JixoApp(config);
};
