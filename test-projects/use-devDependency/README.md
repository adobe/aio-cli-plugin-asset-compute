This simulates a project with a devDependency that points to a _different_ version
of `@adobe/aio-cli-plugin-asset-compute`.

This is achieved by including the tarball of the plugin which has slightly different code.

The custom `adobe-aio-cli-plugin-asset-compute.tgz` was created like the following - see also [test.patch](test.patch):

1. set project root `package.json` to have version `0.0.1`

2. change `src/commands/asset-compute/run-worker.js` and replace the `run()` function with:

   ```
   // BEGIN MODIFICATION
   console.log("DEVDEPENDENCY TEST");
   // END MODIFICATION
   ```

3. in project root run

   ```
   npm pack && mv adobe-aio-cli-plugin-asset-compute-*.tgz test-projects/use-devDependency/adobe-aio-cli-plugin-asset-compute.tgz
   ```

4. to force update of the devDependency from the tarball locally

   ```
   cd test-projects/use-devDependency
   rm -rf package-lock.json node_modules/
   npm install
   ```