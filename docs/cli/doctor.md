# doctor

Checks the requirements for running JIXO.

## Usage

```bash
jixo doctor
```

This command checks if your environment meets the necessary requirements to run JIXO. It performs checks on tools and their versions, according to the configuration in `jixo.config.json`. It will output a report indicating whether each tool is present and meets the minimum version requirements.

## Checks Performed

The doctor command performs the following checks:

- **Tool Existence:** Verifies that the required tools are installed and accessible in your environment.
- **Version Check:** Validates that the installed versions of the tools meet the minimum version requirements specified in the configuration.

## Output

The command provides a detailed report with the following information for each tool:

- **Tool ID:** A unique identifier for the tool.
- **Display Name:** A human-readable name for the tool.
- **Exists:** Indicates whether the tool is found in the environment.
- **Version:** The actual version of the tool found in the environment.
- **Required Version:** The minimum version of the tool required by JIXO.
- **Meets Version Requirement:** Indicates whether the installed version meets the minimum version requirement.
- **Message:** A descriptive message about the check result.
- **Installation Hint:** A hint on how to install the tool if it is missing or the version is incorrect.
