#!/usr/bin/env node
import {tryRunCli} from "@jixo/cli";
export * from "@jixo/cli";

tryRunCli(import.meta);
