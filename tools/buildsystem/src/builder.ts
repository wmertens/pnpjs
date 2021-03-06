declare var require: (s: string) => any;
const path = require("path");
const colors = require("ansi-colors");
const log = require("fancy-log");

import { BuildContext } from "./tasks/build/context";
import { BuildSchema } from "./tasks/build/schema";

/**
 * Engine function to process build files
 * 
 * @param version The version to be written into all the build packages
 * @param config The build configuration object
 * @param callback (err?) => void
 */
export function builder(version: string, config: BuildSchema): Promise<void> {

    // it matters what order we build things as dependencies must be built first
    // these are the folder names witin the packages directory to build
    return config.packages.reduce((pipe: Promise<void>, pkg) => {

        if (typeof pkg === "string") {
            pkg = { name: pkg };
        }

        // gate the package names so folks don't try and run code down the line
        if (!/^[\w-]+$/i.test(pkg.name)) {
            throw new Error(`Bad package name "${pkg.name}".`);
        }

        const projectFolder = path.join(config.packageRoot, pkg.name);

        const projectFile = path.join(projectFolder, config.configFile || "tsconfig-build.json");
        const tsconfigObj = require(projectFile);

        // establish the context that will be passed through all the build pipeline functions
        const buildContext: BuildContext = {
            assets: pkg.assets || config.assets,
            name: pkg.name,
            projectFile: projectFile,
            projectFolder: projectFolder,
            targetFolder: path.join(projectFolder, tsconfigObj.compilerOptions.outDir),
            tsconfigObj: tsconfigObj,
            version: version,
        };

        // select the correct build pipeline
        const activeBuildPipeline = pkg.buildPipeline || config.buildPipeline;

        // log we have added the file
        log(`${colors.bgblue(" ")} Adding ${colors.cyan(buildContext.projectFile)} to the build pipeline.`);

        return activeBuildPipeline.reduce((subPipe, func) => subPipe.then(() => func(buildContext)), pipe).then(_ => {

            log(`${colors.bggreen(" ")} Built ${colors.cyan(buildContext.projectFile)}.`);

        }).catch(e => {

            log(`${colors.bgred(" ")} ${colors.bold(colors.red(`Error building `))} ${colors.bold(colors.cyan(buildContext.projectFile))}.`);
            log(`${colors.bgred(" ")} ${colors.bold(colors.red("Error:"))} ${colors.bold(colors.white(typeof e === "string" ? e : JSON.stringify(e)))}`);
        });

    }, Promise.resolve());
}
