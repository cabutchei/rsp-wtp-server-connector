/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
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
    started?: boolean;
    running?: boolean;
}

interface JdtlsCommandResult<T> {
    success: boolean;
    message?: string;
    payload?: T;
}

export class EquinoxRspLauncher {
    private static readonly BOOTSTRAP_COMMAND = 'com.github.cabutchei.rsp.jdtls.bootstrap';
    private static readonly STATUS_COMMAND = 'com.github.cabutchei.rsp.jdtls.status';
    private static readonly STOP_COMMAND = 'com.github.cabutchei.rsp.jdtls.stop';

    private options: EquinoxRspLauncherOptions;

    constructor(options: EquinoxRspLauncherOptions) {
        this.options = options;
    }

    public async start(stdoutCallback: (data: string) => void,
        _stderrCallback: (data: string) => void,
        _api: EquinoxRspController): Promise<ServerInfo> {

        const result = await this.executeBridgeCommand<EmbeddedRspBootstrapPayload>(
            EquinoxRspLauncher.BOOTSTRAP_COMMAND,
            { instanceId: this.options.rspId }
        );
        if (result.message && result.message.trim().length > 0) {
            stdoutCallback(result.message);
        }
        const payload = result.payload;
        if (!payload || !payload.port) {
            return Promise.reject('Bootstrap command did not return a socket port.');
        }
        return {
            host: payload.host || 'localhost',
            port: payload.port,
            spawned: payload.started === true
        };
    }

    public async terminate(): Promise<void> {
        await this.executeBridgeCommand<unknown>(EquinoxRspLauncher.STOP_COMMAND, {});
    }

    public async getStatus(): Promise<EmbeddedRspBootstrapPayload | undefined> {
        const result = await this.executeBridgeCommand<EmbeddedRspBootstrapPayload>(
            EquinoxRspLauncher.STATUS_COMMAND,
            {}
        );
        return result.payload;
    }

    private async executeBridgeCommand<T>(command: string, args: Record<string, unknown>): Promise<JdtlsCommandResult<T>> {
        let result: JdtlsCommandResult<T> | undefined;
        try {
            result = await vscode.commands.executeCommand<JdtlsCommandResult<T>>(
                'java.execute.workspaceCommand',
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
}
