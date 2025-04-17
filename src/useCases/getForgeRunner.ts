import chalk from "chalk";
import { Command } from "commander";
import { execa } from "execa";
import { FileForgeData, ForgeRunner, PromptsHelper } from "file-forge";
import fs from 'fs-extra';
import { glob } from "glob";
import { join } from "path";
import { pathToFileURL } from "url";
import { waitForCleanup } from "./cleanUpExecutions";

interface GetForgeRunnerArgs {
    forge: FileForgeData.ForgeInfo;
    task: FileForgeData.TaskInfo;
    program: Command;
    rebuild?: boolean
}

export async function getForgeRunner({ forge, task, program, rebuild }: GetForgeRunnerArgs) {
    await waitForCleanup()

    let filePath = task.filePath

    if (forge.isTypescript && forge.distExist && !rebuild) {
        rebuild = forge.rebuildStrategy == 'always'

        if (forge.isTypescript && forge.rebuildStrategy == 'ask') {
            const answer = await PromptsHelper.prompt({
                name: 'rebuild',
                type: 'confirm',
                message: 'Rebuild the typescript project?'
            })

            rebuild = answer.rebuild
        }
    }

    if (forge.isTypescript && (!forge.distExist || rebuild)) {
        console.log(chalk.yellow("Typescript project detected, preparing to build the project.\n"))
        const packageJson = join(forge.directory, 'package.json')
        const json = await fs.readJSON(packageJson)

        if (!json['scripts']?.['build']) {
            console.log(chalk.red("Build your typescript project or add a script called 'build' in your package.json."))
            process.exit(1)
        }

        console.log(`Installing ${chalk.cyan(forge.name)}`)
        const { failed: installFailed, all: installOutput } = await execa(`npm install`, { all: true, shell: true, reject: false, cwd: forge.directory })

        if (installFailed) {
            console.log(installOutput + '\n')
            console.log(chalk.red(`An error ocurred during 'npm install'`))
            process.exit(1)
        }

        console.log(`Building ${chalk.cyan(forge.name)}`)
        const { failed: buildFailed, all: buildOutput } = await execa(`npm run build`, { all: true, shell: true, reject: false, cwd: forge.directory })

        if (buildFailed) {
            console.log(buildOutput + '\n')
            console.log(chalk.red(`An error ocurred during 'npm run build'`))
            process.exit(1)
        }

        if (!await fs.exists(join(forge.directory, 'dist'))) {
            console.log(chalk.red("The project was built but no dist was created"))
            process.exit(1)
        }

        const distDir = join(forge.directory, "dist", task.id)
        const files = await glob('index.+(js|mjs|cjs)', { cwd: distDir, absolute: true, nodir: true, stat: true, dot: true })
        if (!files.length) {
            console.log(chalk.red(`The project was built but the directory '${distDir}' has no index file`))
            process.exit(1)
        }

        filePath = files[0]
        console.log(chalk.green("Build complete\n"))
    }

    const moduleUrl = pathToFileURL(filePath)
    const module = await import(moduleUrl.href)

    if (!module.default) {
        console.log(`There is nothing being exported as default the index script.\n`)
        console.log(`Make sure to export the forge as default:`)
        console.log(`\texport default createForge()`)
    }

    if (!('buildRunner' in module.default)) {
        console.log(`The default export is not a valid instance.\n`)
        console.log(`Make sure to export the forge as default:`)
        console.log(`\texport default createForge()`)
    }

    const runner = await module.default.buildRunner({
        program: program,
        targetDir: process.cwd(),
        rootDir: forge.directory,
        taskName: task.id
    })

    if (!('run' in runner)) {
        console.log(`The built object is not a valid runner.\n`)
        console.log(`Make sure to export the forge as default:`)
        console.log(`\texport default createForge()`)
    }

    return runner as ForgeRunner
}