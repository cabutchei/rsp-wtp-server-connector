# WTP RSP Server Connector

`WTP RSP Server Connector` is the VS Code extension that launches and connects the local WTP-RSP server distribution to the `WTP RSP UI` extension.

It is the bridge between the VS Code UI and the Eclipse/WTP-based server process shipped by this toolchain.

## What this extension does

- Starts and stops the local WTP-RSP server process
- Connects the UI extension to that server over RSP/WTP-RSP
- Packages the local product into the extension's `server/` directory for distribution
- Installs the companion `WTP RSP UI` extension as a dependency
- Exposes connector-specific utility commands such as opening workspace storage

## Relationship to the other projects

This repository is only one piece of the full stack:

- `rsp-wtp-ui`: the VS Code UI layer
- `rsp-wtp-server`: the Eclipse/WTP-based RSP server implementation
- `rsp-wtp-client`: the generated protocol client used by the UI
- `jdtls-jrecontainer-plugin`: the JDT LS companion used for Java runtime and classpath-container synchronization

The connector is responsible for launching the server and making it available to the UI.

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

Runtime behavior is typically controlled through:

- `WTP RSP UI` settings such as `wtp-rsp-ui.rsp.java.home`
- environment variables used during local development and packaging
- the packaged server distribution copied into `server/`

## Fork origin

This project started as a fork of the original Red Hat `vscode-server-connector` project:

- https://github.com/redhat-developer/vscode-server-connector

This fork adapts that foundation for the WTP-RSP toolchain and its current server packaging and launch flow.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) if present in the repository, and the companion project documentation for packaging and server-build details.

## License

EPL 2.0. See [LICENSE](LICENSE).
