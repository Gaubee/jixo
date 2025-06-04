import {defineEnv} from "@gaubee/node";

export const safeEnv = defineEnv("JIXO", {
  DEEPSEEK_API_KEY: "",
  DEEPSEEK_BASE_URL: "",

  ANTHROPIC_API_KEY: "",
  ANTHROPIC_BASE_URL: "",

  OPENAI_API_KEY: "",
  OPENAI_BASE_URL: "",
  OPENAI_ORGANIZATION: "",

  GOOGLE_API_KEY: "",
  GOOGLE_BASE_URL: "",

  XAI_BASE_URL: "",
  XAI_API_KEY: "",

  DEEPINFRA_BASE_URL: "",
  DEEPINFRA_API_KEY: "",
});

console.log("QAQ env", safeEnv);
