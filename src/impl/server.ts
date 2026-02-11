/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as cp from 'child_process';
import * as path from 'path';
import * as portfinder from 'portfinder';
import * as requirements from './requirements';
import * as vscode from 'vscode';
import { ServerInfo, ServerState } from 'rsp-wtp-server-connector-api';
import * as waitOn from 'wait-on';
import * as tcpPort from 'tcp-port-used';
import * as fs from 'fs-extra';
import { homedir } from 'os';
import { ErrorMsgBtn, RequirementsResult, RspRequirementsRejection } from './requirements';
import { Uri } from 'vscode';
import { FelixRspController } from './controller';

export interface HostPortSpawned {
    host: string;
    port: number;
    spawned: boolean;
}

export interface EquinoxRspLauncherOptions {
    providerId: string;
    providerName: string;
    rspId: string;
    minPort: number;
    maxPort: number;
    connectionDelay: number;
    connectionPollFrequency: number;
    minimumSupportedJava: number;
    getImagePathForServerType: (serverType: string) => Uri;
}

export class EquinoxRspLauncher {
    private options: EquinoxRspLauncherOptions;
    private cpProcess: cp.ChildProcess;
    private javaHome: string;
    private port: number;
    private spawned: boolean;
    constructor(options: EquinoxRspLauncherOptions) {
        this.options = options;
    }

    public async start(stdoutCallback: (data: string) => void,
        stderrCallback: (data: string) => void,
        api: FelixRspController): Promise<ServerInfo> {

        let requirementResult: RequirementsResult = undefined;
        try {
            requirementResult = await requirements.resolveRequirements(this.options.minimumSupportedJava);
        } catch(err) {
            return Promise.reject(err);
        }
        if(!requirementResult) {
            return Promise.reject('Unable to find java_home and java version, reason unknown');
        }
        if(requirementResult.unexpectedError) {
            return Promise.reject(requirementResult.unexpectedError);
        }

        if(requirementResult.rejection) {
            const rejection: RspRequirementsRejection = requirementResult.rejection;
            this.displayRequirementRejection(rejection);
            return;
        }

        this.javaHome = requirementResult.data.java_home;
        const options: portfinder.PortFinderOptions = {
            port: this.options.minPort,
            stopPort: this.options.maxPort
        };
        const serverPort: number = await portfinder.getPortPromise(options);
        const hps: HostPortSpawned = await this.startServerAndWaitOnPort(serverPort, stdoutCallback, stderrCallback, api);
        this.port = hps.port;
        this.spawned = hps.spawned;
        
        if (!this.port) {
            return Promise.reject('Could not allocate a port for the rsp server to listen on.');
        } else {
            return Promise.resolve({
                port: this.port,
                host: 'localhost',
                spawned: this.spawned
            });
        }
    }

    private getLockFile(): string {
        const lockFile = path.resolve(homedir(), '.rsp', this.options.rspId, '.lock');
        return lockFile;
    }

    private lockFileExists(lockFile: string): boolean {
        if (fs.existsSync(lockFile)) {
            return true;
        }
        return false;
    }

    private getLockFilePort(lockFile: string): string | null {
        if (fs.existsSync(lockFile)) {
            const port = fs.readFileSync(lockFile, 'utf8');
            return port;
        }
        return null;
    }


    private async lockFilePortInUse(lockFile: string): Promise<boolean> {
        if (fs.existsSync(lockFile)) {
            const port = fs.readFileSync(lockFile, 'utf8');
            const isBusy = await tcpPort.check(+port);
            return isBusy;
        }
        return false;
    }

    private getServerLocation(process: NodeJS.Process): string {
        return process.env.RSP_SERVER_LOCATION ?
            process.env.RSP_SERVER_LOCATION : path.resolve(__dirname, '..', '..', '..', 'server', 'plugins');
    }

    private startServer(
        location: string, 
        port: number, 
        javaHome: string,
        stdoutCallback: (data: string) => void, 
        stderrCallback: (data: string) => void, api: FelixRspController): void {

        const equinox = path.join(location, 'org.eclipse.equinox.launcher_1.5.300.v20190213-1655.jar');
        const java = path.join(javaHome, 'bin', 'java');
        const storagePath = process.env['VSCODE_STORAGE_PATH'];
        // Debuggable version
        // const suspend = 'y';
        // const debugPort = 5007;
        // const consoleLog = '-consoleLog';
        // const args: string[] = [`-agentlib:jdwp=transport=dt_socket,server=y,address=${debugPort},suspend=${suspend}`, `-Drsp.server.port=${port}`,
        //     '-jar', equinox, '-data', storagePath, consoleLog];
        // this.cpProcess = cp.spawn(java, args, { cwd: location });
        // Production version
        this.cpProcess = cp.spawn(java, [`-Drsp.server.port=${port}`, `-Dorg.jboss.tools.rsp.id=${this.options.rspId}`, '-Dlogback.configurationFile=./conf/logback.xml',
            '-jar', equinox, '-data', storagePath], { cwd: location, env: process.env });
        if(this.cpProcess) {
            if (this.cpProcess.stdout)
                this.cpProcess.stdout.on('data', stdoutCallback);
            if (this.cpProcess.stderr)
                this.cpProcess.stderr.on('data', stderrCallback);
            this.cpProcess.on('close', () => {
                if (api != null) {
                    api.updateRSPStateChanged(ServerState.STOPPED);
                }
            });
            this.cpProcess.on('exit', () => {
                if (api != null) {
                    api.updateRSPStateChanged(ServerState.STOPPED);
                }
            });
        }
    }

    public async terminate(): Promise<void> {
        try {
            if (this.cpProcess) {
                this.cpProcess.removeAllListeners();
                this.cpProcess.kill();
            }
        } catch (err) {
            return Promise.reject(err);
        }
    }
    private async startServerAndWaitOnPort(
        serverPort: number, 
        stdoutCallback: (data: string) => void,
        stderrCallback: (data: string) => void, 
        api: FelixRspController): Promise<HostPortSpawned> {

        let localPort = serverPort;
        let localSpawned = false;
        const lockFile: string = this.getLockFile();
        const lockFileExist: boolean = this.lockFileExists(lockFile);
        const portInUse: boolean = await this.lockFilePortInUse(lockFile);

        if(lockFileExist && portInUse) {
            const p = this.getLockFilePort(lockFile);
            if (p) {
                localPort = +p;
            }
            localSpawned = false;
        } else {
            if(lockFileExist && !portInUse) {
                fs.unlinkSync(lockFile);
            }
            // localPort = serverPort;
            localPort = 27511;
            const serverLocation = this.getServerLocation(process);
            this.startServer(serverLocation, localPort, this.javaHome, stdoutCallback, stderrCallback, api);
            localSpawned = true;
        }

        const opts = {
            resources: [`tcp:localhost:${localPort}`],
            delay: this.options.connectionDelay, 
            interval: this.options.connectionPollFrequency,
            simultaneous: 1 // limit connection attempts to one per resource at a time
        };
        await waitOn(opts);
        const ret: HostPortSpawned = {
            host: 'localhost',
            port: localPort,
            spawned: localSpawned,
        };
        return ret;
    }
    private displayRequirementRejection(error: RspRequirementsRejection) {
        if(error) {
            const msg = error.message;
            const buttonArray: ErrorMsgBtn[] = error.btns || [];
            const buttonLabels:string[] = buttonArray.map(btn => btn.label);
            // show error
            vscode.window.showErrorMessage(msg, ...buttonLabels)
                .then(selection => {
                    const btnSelected = buttonArray.find(btn => btn.label === selection);
                    if (btnSelected) {
                        if (btnSelected.openUrl) {
                            vscode.commands.executeCommand('vscode.open', btnSelected.openUrl);
                        } else {
                            vscode.window.showInformationMessage(
                                `To configure Java for the RSP-WTP Server Connectors Extension, add "rsp-wtp-ui.rsp.java.home" property to your settings file
                        (ex. "rsp-wtp-ui.rsp.java.home": "/usr/local/java/jdk-${this.options.minimumSupportedJava}.0.1").`);
                            vscode.commands.executeCommand(
                                'workbench.action.openSettingsJson'
                            );
                        }
                    }
                });
        }
    }
}
