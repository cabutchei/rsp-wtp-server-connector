# JBoss Toolkit

<!-- [![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/redhat.vscode-server-connector?style=for-the-badge&label=VS%20Marketplace&logo=visual-studio-code&color=blue)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-server-connector)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/redhat.vscode-server-connector?style=for-the-badge&color=purple)](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-server-connector)
[![License](https://img.shields.io/badge/license-EPLv2.0-brightgreen.png?style=for-the-badge)](https://github.com/redhat-developer/vscode-server-connector/blob/master/LICENSE) -->

A Visual Studio Code extension for interacting with IBM Servers and Runtimes like WebSphere Application Server and Liberty.

### Supported Servers
   * WAS 8.5
   * Open Liberty 25+

## Commands and features

![ screencast ](https://raw.githubusercontent.com/redhat-developer/vscode-server-connector/master/screencast/vscode-server-connector.gif)

This extension depends on VSCode RSP-WTP UI Extension which is going to be installed automatically along with the WebSphere Tools Extension. RSP UI, in conjunction with WebSphere Tools Extension supports several commands for interacting with supported server adapters; these are accessible via the command menu (`Cmd+Shift+P` on macOS or `Ctrl+Shift+P` on Windows and Linux) and may be bound to keys in the normal way.

### Available Commands
   This extension provides no additional commands other than those available in [rsp-wtp-ui](https://github.com/redhat-developer/rsp-wtp-ui#available-commands)

## Extension Settings
   This extension provides no additional settings other than those available in [rsp-wtp-ui](https://github.com/redhat-developer/rsp-wtp-ui#extension-settings)

<!-- ## Server Parameters
   This extension provides some ADDITIONAL server parameters in addition to those available in rsp-wtp-ui. To see a list of global server parameters, please go [here](https://github.com/redhat-developer/rsp-wtp-ui#server-parameters). Below are JBoss / WildFly specific parameters.

   * `"args.vm.override.string"` - allow to override VM arguments. Once you edit this flag, *make sure "args.override.boolean" is set to true before launching your server. Otherwise, the server will attempt to auto-generate the launch arguments as it normally does.*
   * `"args.program.override.string"` - allow to override program arguments. Once you edit this flag, *make sure "args.override.boolean" is set to true before launching your server. Otherwise, the server will attempt to auto-generate the launch arguments as it normally does.*

   * `"jboss.server.host"` - allow to set the host you want the current JBoss/Wildfly instance to bind to (default localhost)
   * `"jboss.server.port"` - allow to set the port you want the current JBoss/Wildfly instance to bind to (default 8080)
   * `"wildfly.server.config.file"` - the name of the configuration file to be used for the current Jboss/Wildfly instance. The file has to be stored in the same folder as the default standalone.xml file. (e.g "wildfly.server.config.file": "newconfigfile.xml") -->

-----------------------------------------------------------------------------------------------------------
<!-- ## Install extension locally
This is an open source project open to anyone. This project welcomes contributions and suggestions!!

Download the most recent `adapters-<version>.vsix` file and install it by following the instructions [here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix).

Stable releases are archived under http://download.jboss.org/jbosstools/adapters/snapshots/vscode-middleware-tools -->

## Community, discussion, contribution, and support

**Issues:** If you have an issue/feature-request with the JBoss Toolkit extension, please file it [here](https://github.com/redhat-developer/rsp-wtp-server-connector/issues).

**Contributing:** Want to become a contributor and submit your code? Have a look at our [development guide](https://github.com/redhat-developer/rsp-wtp-server-connector/blob/master/CONTRIBUTING.md).

**Chat:** Open a [Discussion on GitHub](https://github.com/redhat-developer/rsp-wtp-server-connector/discussions)

**UI Testing:**

You can perform UI testing by running the following commands:
1. Download the package and its dependencies
```sh
npm install
```
2. Build the project
```sh
npm run build
```
3. Run UI tests
```sh
npm run public-ui-test
```

License
=======
EPL 2.0, See [LICENSE](LICENSE) for more information.
