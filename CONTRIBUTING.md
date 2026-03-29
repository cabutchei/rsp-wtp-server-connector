# Contributing

## Using local rsp-wtp-client 

When adding new features into the code base, you may need to modify the ```rsp-wtp-client``` code base as well.
As ```rsp-wtp-client``` is an npm dependency, by default, it will fetch the code from the global npm registry.

In order to get faster feedback, here is the procedure to work locally on the two different codebases in parallel.

- clone the two repos on your local workstation
- in the ```rsp-wtp-server-connector``` folder, run the following command: ```npm link ../rsp-wtp-client``` (assumed the two folders are at the same level in the folder hierarchy)
- the ```rsp-wtp-server-connector``` codebase will now use the local codebase of ```rsp-wtp-client``` instead of the one from the global npm registry.
- if you make modifications to the ```rsp-wtp-client``` codebase, you must run the following command (from the local ```rsp-wtp-client``` folder): ```npm run build``` so that the Javascript files are regenerated.
### Certificate of Origin

By contributing to this project you agree to the Developer Certificate of
Origin (DCO). This document was created by the Linux Kernel community and is a
simple statement that you, as a contributor, have the legal right to make the
contribution. See the [DCO](DCO) file for details.
