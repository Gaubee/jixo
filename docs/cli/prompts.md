# prompts

Manages JIXO prompts.

## Usage

```bash
jixo prompts [options]
```

This command provides options for listing and upgrading JIXO prompts.

### Options

- `-D, --dir`: Specifies the project directory containing the `jixo.config.json` file. Defaults to the current directory.
- `-M, --mirrorUrl`: Specifies the URL for downloading prompts from a mirror.
- `-U, --upgrade`: Upgrades the built-in prompts to the latest version.

### Listing Prompts

To list the available prompts, run the command without any options:

```bash
jixo prompts
```

This will display a list of available prompts with their descriptions and parent prompts (if any).

### Upgrading Prompts

To upgrade the built-in prompts, use the `--upgrade` option:

```bash
jixo prompts --upgrade
```

This will download the latest prompts from the JIXO prompt repository and update your local prompts.
You can use the `--mirrorUrl` option to specify a different prompt repository URL.
