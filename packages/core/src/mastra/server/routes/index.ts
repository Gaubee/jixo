import type {ApiRoute} from "./types.js";
import {healthApi} from "./v1/health.js";
import {jobsApi} from "./v1/jobs.js";

export const routes: ApiRoute[] = [...healthApi, ...jobsApi];
