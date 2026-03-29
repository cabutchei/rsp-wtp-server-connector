/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import { EventEmitter } from 'events';
import { Uri } from 'vscode';
import { RSPController, ServerInfo, ServerState } from 'rsp-wtp-server-connector-api';
import { EquinoxRspLauncher, EquinoxRspLauncherOptions } from './server';

export class EquinoxRspController implements RSPController {
    private opts: EquinoxRspLauncherOptions;
    private launcher: EquinoxRspLauncher;
    private host: string;
    private port: number;
    private emitter: EventEmitter;

    public constructor(opts: EquinoxRspLauncherOptions) {
        this.opts = opts;
        this.launcher = new EquinoxRspLauncher(opts);
        this.host = '';
        this.port = 0;
        this.emitter = new EventEmitter();
    }

    public getLauncher(): EquinoxRspLauncher {
        return this.launcher;
    }
    
    public async startRSP(stdoutCallback: (data: string) => void, stderrCallback: (data: string) => void): Promise<ServerInfo>  {
        this.updateRSPStateChanged(ServerState.STARTING);
        try {
            const startResult: ServerInfo = await this.launcher.start(stdoutCallback, stderrCallback, this);
            if(startResult) {
                this.host = startResult.host;
                this.port = startResult.port;
                this.updateRSPStateChanged(ServerState.STARTED);
                return startResult;
            } else {
                return this.handleStartError('No result from launcher.start');
            }
        } catch(error) {
            return this.handleStartError(error);
        }
    }

    private async handleStartError(error) {
        this.updateRSPStateChanged(ServerState.STOPPED);
        const innerMsg: string = error ? (error.message ? error.message : JSON.stringify(error)) : '';
        return Promise.reject(`RSP Error - ${this.opts.providerName} failed to start - ${innerMsg}`);
    }

    public async stopRSP(): Promise<void> {
        this.launcher.terminate().catch(error => {
            const innerMsg: string = error ? (error.message ? error.message : JSON.stringify(error)) : '';
            return Promise.reject(`RSP Error - ${this.opts.providerName} failed to stop - ${innerMsg}`);
        });
    }

    public getImage(serverType: string): Uri {
        if (!serverType) {
            return null;
        }
        const toCall = this.opts.getImagePathForServerType;
        if(!toCall) {
            return null;
        }
        return toCall(serverType);
    }

    public onRSPServerStateChanged(listener: (state: number) => void): void {
        this.emitter.on('rspServerStateChanged', listener);
    }

    public async updateRSPStateChanged(state: number): Promise<void> {
        this.emitter.emit('rspServerStateChanged', state);
    }

    public getHost(): string {
        return this.host;
    }

    public getPort(): number {
        return this.port;
    }
}
