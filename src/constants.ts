/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Red Hat, Inc. All rights reserved.
 *  Licensed under the EPL v2.0 License. See LICENSE file in the project root for license information.
 *-----------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { Uri } from 'vscode';
import { EquinoxRspLauncherOptions } from './impl/server';

/**
 * RSP Provider ID
 */
const RSP_PROVIDER_ID = 'cabutchei.wtp-rsp-server-connector';
/**
 * RSP Provider Name - it will be displayed in the tree node
 */
const RSP_PROVIDER_NAME = 'RSP-WTP Server Connectors';

/**
 * The provider id to be used in the .rsp folder
 */
const RSP_ID = 'cabutchei-wtp-rsp-server-connector';

export const getImageFilenameForServerType = (serverType: string): string => {
    if (serverType.startsWith('org.jboss.ide.eclipse.as.7')) {
        return 'jbossas7_ligature.svg';
    } else if (serverType.startsWith('org.jboss.ide.eclipse.as.wildfly.')) {
        return 'wildfly_icon.svg';
    } else if (serverType.startsWith('org.jboss.ide.eclipse.as.eap.')) {
        return 'jboss.eap.png';
    } else if (serverType.startsWith('org.jboss.tools.openshift.cdk.server.type')) {
        return 'Logotype_RH_OpenShift.svg';
    } else if (serverType.startsWith('com.ibm.ws.ast.st.v85.server.base')) {
        return 'liberty.png';
    } else if (serverType.startsWith('com.ibm.ws.st.server.wlp')) {
        return 'liberty.png';
    } else {
        return 'server-light.png';
    }
};

export const OPTIONS: EquinoxRspLauncherOptions = {
    providerId: RSP_PROVIDER_ID,
    providerName: RSP_PROVIDER_NAME,
    rspId: RSP_ID,
    getImagePathForServerType: function (serverType: string): Uri {
        const tmpPath: string = getImageFilenameForServerType(serverType);
        if(tmpPath)
            return Uri.file(path.join(__dirname, '..', '..', 'images', tmpPath));
        return null;
    }
};
