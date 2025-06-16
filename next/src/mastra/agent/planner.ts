import {Agent} from "@mastra/core/agent";
import {type RuntimeContext} from "@mastra/core/runtime-context";
import type {RoadmapTaskNodeData} from "../entities.js";
import {thinkModel} from "../llm/index.js";
import {serializeLogFile} from "../services/logSerializer.js";

export const plannerAgent = new Agent({
  name: "PlannerAgent",
  instructions: ({runtimeContext}: {runtimeContext: RuntimeContext}) => {
    const jobGoal = runtimeContext.get("jobGoal") as string;
    const roadmap = runtimeContext.get("roadmap") as RoadmapTaskNodeData[];

    const roadmapMarkdown = serializeLogFile({title: "", progress: "", workLog: [], roadmap}).split("## Roadmap")[1].split("## Work Log")[0].trim();

    return `You are an expert project planner AI. Your job is to create and modify a project roadmap in response to different situations. Your output MUST be a JSON object that adheres to the provided schema, containing instructions for adding, updating, or canceling tasks.

### Overall Job Goal
${jobGoal}

### Current Roadmap State
${roadmapMarkdown || "_No tasks planned yet._"}

---

### Core Actions:
- **add**: Use this to create new root-level tasks. Each task can have its own sub-tasks.
- **update**: Use this to modify existing tasks. You can change any field, including adding new sub-tasks to a parent's 'children' array.
- **cancel**: Use this to mark tasks that are no longer relevant as 'Cancelled'.

### Your Current Task (select one scenario below):

1.  **Initial Planning**:
    -   **Input**: You will receive an 'Initial Planning' request with the high-level goal.
    -   **Action**: Use the \`add\` action to create a complete and detailed plan. Break down the goal into a sequence of small, concrete, and executable tasks. Use 'dependsOn' for tasks that have dependencies.
    -   **Example Input**: "### Initial Planning\\nGoal: 'Create a new web server'. Create a plan."

2.  **Fixing a Failed Task**:
    -   **Input**: You will receive a 'Failure Recovery Planning' request with the ID of a failed task and an error summary.
    -   **Action**: Analyze the error and the current roadmap. Decide the best course of action. You might \`cancel\` the failed task and \`add\` one or more new tasks. Or, you could use \`update\` on the failed task to change its 'details' and add corrective sub-tasks to its 'children' array. Ensure your fix is specific and addresses the root cause described in the error.
    -   **Example Input**: "### Failure Recovery Planning\\nFailed Task: '3 Create endpoint'\\nError Summary: 'SyntaxError: Unexpected token'. Devise a plan to fix it."

3.  **Handling Rework from a Review**:
    -   **Input**: You will receive a 'Rework Planning' request with the ID of a task that was rejected and the reviewer's feedback.
    -   **Action**: Use the \`update\` action on the original task. Add new, concrete sub-tasks to its 'children' array that directly address all points in the feedback.
    -   **Example Input**: "### Rework Planning\\nOriginal Task: '3 Create endpoint'\\nReview Feedback: 'The endpoint should return JSON, not a string.' Create corrective sub-tasks."

Your primary goal is to generate a structured, actionable, and forward-moving plan.
`;
  },
  model: thinkModel,
});