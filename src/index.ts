#!/usr/bin/env node

import chalk from "chalk"
import { Command, Option } from "commander"
import { GlobHelper, HyperForgeData } from "hyper-forge"
import { buildRootRoute, runRoute } from "./router"
import { cleanup } from "./useCases/cleanUpExecutions"
import { getForgeRunner } from "./useCases/getForgeRunner"
import { installForgeDirectory } from "./useCases/install-forge-directory/installForgeDirectory"
import { installFromGit } from "./useCases/install-forge-git/installFromGit"
import { getForges, readForges } from "./useCases/readForges"
import { uninstallForge } from "./useCases/uninstall-forge/uninstallForge"
import { uninstallMissingForges } from "./useCases/uninstall-missing-forges/uninstallMissingForges"

readForges()
cleanup()

const program = new Command('hf')

if (process.argv.length == 2) {
    const root = buildRootRoute(program)
    await runRoute(root)
    process.exit()
}

const list = new Command('list')
    .description('Lists all installed forges and its tasks')
    .action(async () => {
        const forges = await getForges()
        forges.sort((a, b) => {
            return a.id.localeCompare(b.id)
        })

        console.log(chalk.bold('Available forges:'))
        for (const forge of forges) {
            console.log(` - ${chalk.blue(forge.id)} - ${forge.description}`)

            forge.tasks.sort((a, b) => a.id.localeCompare(b.id))
            for (const task of forge.tasks) {
                console.log(`   - ${chalk.green(task.id)} - ${task.description}`)
            }
            console.log()
        }
    })

const runCommand = new Command('run')
    .description('Run a forge task')
    .argument('[forge]', 'The id of the forge')
    .argument('[task]', 'The id of the task')
    .option('--rebuild', 'Rebuilds typescript projects')
    .option('--disable-prompt-confirmation', 'Disables confirmation after prompts')
    .option('-h, --help', 'display help for command')
    .usage('<forge> <task> [options]')
    .helpOption(false)
    .helpCommand(false)
    .action(async (forgeId, taskId) => {
        runCommand.configureHelp({
            sortOptions: true,
            sortSubcommands: true
        })

        const opts = runCommand.opts()
        if (!taskId && opts.help) {
            runCommand.help()
        }

        if (!forgeId) {
            runCommand.error(`error: missing required argument 'forge-id'`)
        }

        if (!taskId) {
            runCommand.error(`error: missing required argument 'task-id'`)
        }

        const forges = await getForges()
        if (!forges || forges.length == 0) {
            console.log(chalk.red('No forges installed'))
            process.exit(1)
        }

        const forge = forges.find(e => e.id == forgeId)
        if (!forge) {
            console.log(chalk.red('Forge does not exist'))
            process.exit(1)
        }

        const task = forge?.tasks.find(e => e.id == taskId)
        if (!task) {
            console.log(chalk.red('Task does not exist'))
            process.exit(1)
        }

        const runner = await getForgeRunner({
            forge: forge!,
            task: task!,
            program: runCommand,
            rebuild: opts.rebuild
        })

        if (opts.help) {
            runCommand.help()
        }

        console.log(chalk.bold(`Starting the ${chalk.cyan(task.name)} task from the ${chalk.cyan(forge.name)} forge\n`))
        runner.run()
        console.log(chalk.green.bold('\nThe execution of your task just finished. Till next time!'))
    })

const uninstallCommand = new Command('uninstall')
    .description('Uninstalls a forge')
    .argument('[forge]', 'The id of the forge')
    .option('--missing-directories', 'Uninstall forges whose directories are missing')
    .action(async (forgeId) => {
        const opts = uninstallCommand.opts()
        if (!opts.missingDirectories && !forgeId) {
            uninstallCommand.error(`error: either 'forge-id' or --missing-directories should be informed`)
        }

        if (forgeId) {
            await uninstallForge(forgeId)
        }

        if (opts.missingDirectories) {
            await uninstallMissingForges()
        }
    })

const installCommand = new Command('install')
    .description('Install a forge')

installCommand.addCommand(
    new Command('git')
        .description('Install a forge stored in a git repository')
        .argument('<forges...>', 'The ids of the forges to install or * to install every forge in the repository')
        .requiredOption('-r, --repository <repository>', 'Repository of the forge/forges')
        .option('-b, --branch <branch>', 'Branch of the forge')
        .option('-c, --commit <commit>', 'Commit of the forge')
        .option('--replace', 'Replaces all informed forges if they are already installed')
        .configureHelp({
            styleUsage() {
                return `
  Install every forge in the repository
    hf install git * -r https://example.com/

  Install pre-selected forges in the repository
    hf install git my-forge1 my-forge2 -r https://example.com/`
            },
        })
        .action(async (forgeIds, options) => {
            await installFromGit({
                forgeIds: forgeIds,
                repository: options.repository,
                branch: options.branch,
                commit: options.commit,
                replace: options.replace
            })
        })
)

installCommand.addCommand(
    new Command('local-dir')
        .description('Install a forge stored in a local directory')
        .argument('<directory>', 'Root directory of the forge')
        .option('--replace', 'Replaces the current existing forge')
        .addOption(
            new Option('--rebuild-strategy <strategy>', 'Sets the strategy to decide whether to rebuild the forge or not')
                .choices(HyperForgeData.rebuildStrategies)
        )
        .action(async (dir, options) => {
            await installForgeDirectory({
                directory: dir,
                replace: options.replace,
                rebuildStrategy: options.rebuildStrategy
            })
        })
)

await program
    .addCommand(list)
    .addCommand(runCommand)
    .addCommand(installCommand)
    .addCommand(uninstallCommand)
    .helpCommand(false)
    .configureHelp({
        sortOptions: true,
        sortSubcommands: true,
        styleUsage() {
            return `
  Run the console interface
    hf

  Run the specified command
    hf <command> [options]`
        },
        subcommandTerm(cmd) {
            return cmd.name()
        }
    })
    .parseAsync()