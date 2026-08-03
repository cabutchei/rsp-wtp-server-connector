/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ServerInfo } from 'rsp-wtp-server-connector-api';
import { Uri } from 'vscode';
import { EquinoxRspController } from './controller';

export interface EquinoxRspLauncherOptions {
    providerId: string;
    providerName: string;
    rspId: string;
    getImagePathForServerType: (serverType: string) => Uri;
}

interface EmbeddedRspBootstrapPayload {
    host: string;
    port: number;
    logPath?: string;
    started?: boolean;
    running?: boolean;
}

interface JdtlsCommandResult<T> {
    success: boolean;
    message?: string;
    payload?: T;
}

interface JavaExtensionApi {
    serverReady?: () => Promise<unknown>;
}

class EmbeddedLogTailer {
    private static readonly POLL_INTERVAL_MS = 500;

    private timer: NodeJS.Timeout | undefined;
    private filePath: string | undefined;
    private offset = 0;
    private reading = false;

    constructor(private readonly onData: (data: string) => void) {
    }

    public start(filePath: string | undefined): void {
        this.stop();
        if (!filePath) {
            return;
        }
        this.filePath = filePath;
        this.offset = 0;
        this.timer = setInterval(() => {
            void this.poll();
        }, EmbeddedLogTailer.POLL_INTERVAL_MS);
        void this.poll();
    }

    public stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        this.filePath = undefined;
        this.offset = 0;
        this.reading = false;
    }

    private async poll(): Promise<void> {
        if (this.reading || !this.filePath) {
            return;
        }
        this.reading = true;
        try {
            const stat = await this.stat(this.filePath);
            if (!stat) {
                return;
            }
            if (stat.size < this.offset) {
                this.offset = 0;
            }
            if (stat.size === this.offset) {
                return;
            }
            const length = stat.size - this.offset;
            const handle = await fs.promises.open(this.filePath, 'r');
            try {
                const buffer = Buffer.alloc(length);
                const result = await handle.read(buffer, 0, length, this.offset);
                if (result.bytesRead > 0) {
                    this.offset += result.bytesRead;
                    this.onData(buffer.slice(0, result.bytesRead).toString('utf8'));
                }
            } finally {
                await handle.close();
            }
        } finally {
            this.reading = false;
        }
    }

    private async stat(target: string): Promise<fs.Stats | undefined> {
        try {
            return await fs.promises.stat(target);
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code === 'ENOENT') {
                return undefined;
            }
            throw error;
        }
    }
}

export class EquinoxRspLauncher {
    private static readonly JAVA_EXTENSION_ID = 'redhat.java';
    private static readonly JAVA_WORKSPACE_COMMAND = 'java.execute.workspaceCommand';
    private static readonly COMMAND_REGISTRATION_TIMEOUT_MS = 15000;
    private static readonly COMMAND_REGISTRATION_POLL_MS = 250;
    private static readonly SERVER_READY_TIMEOUT_MS = 30000;
    private static readonly BOOTSTRAP_COMMAND = 'com.github.cabutchei.rsp.jdtls.bootstrap';
    private static readonly STATUS_COMMAND = 'com.github.cabutchei.rsp.jdtls.status';
    private static readonly STOP_COMMAND = 'com.github.cabutchei.rsp.jdtls.stop';

    private options: EquinoxRspLauncherOptions;
    private logTailer: EmbeddedLogTailer | undefined;

    constructor(options: EquinoxRspLauncherOptions) {
        this.options = options;
    }

    public async start(stdoutCallback: (data: string) => void,
        _stderrCallback: (data: string) => void,
        _api: EquinoxRspController): Promise<ServerInfo> {
        this.stopLogTail();
        const requestedLogPath = this.getEmbeddedLogPath();

        const result = await this.executeBridgeCommand<EmbeddedRspBootstrapPayload>(
            EquinoxRspLauncher.BOOTSTRAP_COMMAND,
            { instanceId: this.options.rspId, logPath: requestedLogPath }
        );
        if (result.message && result.message.trim().length > 0) {
            stdoutCallback(`[bridge] ${result.message}`);
        }
        const payload = result.payload;
        if (!payload || !payload.port) {
            return Promise.reject('Bootstrap command did not return a socket port.');
        }
        this.startLogTail(payload.logPath || requestedLogPath, stdoutCallback);
        return {
            host: payload.host || 'localhost',
            port: payload.port,
            spawned: payload.started === true
        };
    }

    public async terminate(): Promise<void> {
        try {
            await this.executeBridgeCommand<unknown>(EquinoxRspLauncher.STOP_COMMAND, {});
        } finally {
            this.stopLogTail();
        }
    }

    public async getStatus(): Promise<EmbeddedRspBootstrapPayload | undefined> {
        const result = await this.executeBridgeCommand<EmbeddedRspBootstrapPayload>(
            EquinoxRspLauncher.STATUS_COMMAND,
            {}
        );
        return result.payload;
    }

    private async executeBridgeCommand<T>(command: string, args: Record<string, unknown>): Promise<JdtlsCommandResult<T>> {
        await this.ensureJavaWorkspaceCommandAvailable();
        let result: JdtlsCommandResult<T> | undefined;
        try {
            result = await vscode.commands.executeCommand<JdtlsCommandResult<T>>(
                EquinoxRspLauncher.JAVA_WORKSPACE_COMMAND,
                command,
                args
            );
        } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            return Promise.reject(new Error(`Failed to execute JDT LS bridge command '${command}': ${reason}`));
        }
        if (!result) {
            return Promise.reject(new Error(`No result returned for JDT LS bridge command '${command}'.`));
        }
        if (!result.success) {
            return Promise.reject(new Error(result.message || `JDT LS bridge command '${command}' failed.`));
        }
        return result;
    }

    private async ensureJavaWorkspaceCommandAvailable(): Promise<void> {
        const javaExtension = vscode.extensions.getExtension(EquinoxRspLauncher.JAVA_EXTENSION_ID);
        if (!javaExtension) {
            return Promise.reject(new Error(`Required extension '${EquinoxRspLauncher.JAVA_EXTENSION_ID}' is not installed.`));
        }
        let javaApi: JavaExtensionApi | undefined;
        if (!javaExtension.isActive) {
            javaApi = await javaExtension.activate() as JavaExtensionApi | undefined;
        } else {
            javaApi = javaExtension.exports as JavaExtensionApi | undefined;
        }
        const deadline = Date.now() + EquinoxRspLauncher.COMMAND_REGISTRATION_TIMEOUT_MS;
        while (Date.now() < deadline) {
            const commands = await vscode.commands.getCommands(true);
            if (commands.includes(EquinoxRspLauncher.JAVA_WORKSPACE_COMMAND)) {
                await this.waitForJavaServerReady(javaApi);
                return;
            }
            await new Promise(resolve => setTimeout(resolve, EquinoxRspLauncher.COMMAND_REGISTRATION_POLL_MS));
        }
        return Promise.reject(new Error(
            `Command '${EquinoxRspLauncher.JAVA_WORKSPACE_COMMAND}' was not registered by '${EquinoxRspLauncher.JAVA_EXTENSION_ID}'.`
        ));
    }

    private async waitForJavaServerReady(javaApi: JavaExtensionApi | undefined): Promise<void> {
        if (!javaApi || typeof javaApi.serverReady !== 'function') {
            return;
        }
        await Promise.race([
            javaApi.serverReady(),
            new Promise((_, reject) => setTimeout(() => {
                reject(new Error(`Timed out waiting for '${EquinoxRspLauncher.JAVA_EXTENSION_ID}' language server readiness.`));
            }, EquinoxRspLauncher.SERVER_READY_TIMEOUT_MS))
        ]);
    }

    private getEmbeddedLogPath(): string | undefined {
        const storagePath = process.env['VSCODE_STORAGE_PATH'];
        if (!storagePath || !storagePath.trim().length) {
            return undefined;
        }
        return path.join(storagePath, `${this.options.rspId}.embedded.log`);
    }

    private startLogTail(logPath: string | undefined, stdoutCallback: (data: string) => void): void {
        if (!logPath) {
            return;
        }
        this.logTailer = new EmbeddedLogTailer((data: string) => {
            stdoutCallback(`[server]\n${data}`);
        });
        this.logTailer.start(logPath);
    }

    private stopLogTail(): void {
        if (this.logTailer) {
            this.logTailer.stop();
            this.logTailer = undefined;
        }
    }
}
