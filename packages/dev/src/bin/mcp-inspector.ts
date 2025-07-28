#!/usr/bin/env node
import {$} from "@gaubee/nodekit";

await $`pnpx @modelcontextprotocol/inspector pnpm ${process.argv.slice(2)}`;
