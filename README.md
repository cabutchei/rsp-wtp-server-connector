# WTP RSP Server Connector

`WTP RSP Server Connector` is the VS Code extension that bootstraps and connects the WTP-RSP server inside the Java extension's Equinox runtime.

It is the bridge between the VS Code UI and the Eclipse/WTP-based server bundles now hosted by vscode-java / JDT LS.

## What this extension does

- Starts and stops the embedded WTP-RSP socket server inside JDT LS
- Connects the UI extension to that server over the existing RSP/WTP-RSP socket protocol
- Contributes the JDT LS bridge bundle through `javaExtensions`
- Installs the companion `WTP RSP UI` extension as a dependency
- Exposes connector-specific utility commands such as opening workspace storage

## Relationship to the other projects

This repository is only one piece of the full stack:

- `rsp-wtp-ui`: the VS Code UI layer
- `rsp-wtp-server`: the Eclipse/WTP-based RSP server implementation
- `rsp-wtp-client`: the generated protocol client used by the UI
- `jdtls-serverbridge-plugin`: the JDT LS bridge project that contributes the embedded RSP lifecycle commands

The connector is responsible for bootstrapping the embedded server and making its socket endpoint available to the UI.

## Supported runtimes

The current bundled server distribution is intended to support these runtime families:

- WebSphere Traditional 8.5
- Open Liberty / Liberty
- JBoss EAP 7.0

The exact availability of those adapters still depends on the packaged server build and its target platform contents.

## Commands

This extension contributes one connector-specific command directly:

- `WTP: Open Connector Workspace Storage`

Most server-management commands shown in VS Code come from `WTP RSP UI`, but they depend on this connector to start and connect the local server.

## Settings

This extension does not currently contribute user-facing settings of its own.

## Fork origin

This project started as a fork of the original Red Hat `vscode-server-connector` project:

- https://github.com/redhat-developer/vscode-server-connector

This fork adapts that foundation for the WTP-RSP toolchain and its embedded-JDT-LS bootstrap flow.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) if present in the repository, and the companion project documentation for packaging and server-build details.

## License

EPL 2.0. See [LICENSE](LICENSE).
