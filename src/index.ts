#!/usr/bin/env node

import chalk from "chalk"
import { Argument, Command, Option } from "commander"
import { ConfigHandler, HyperForgeData } from "hyper-forge"
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

let commandRunning = false
const runCommand = new Command('run')
    .description('Run a forge task')
    .argument('[forge]', 'The id of the forge')
    .argument('[task]', 'The id of the task')
    .option('--rebuild', 'Rebuilds typescript projects')
    .option('--disable-prompts', 'Disables prompts')
    .option('--disable-prompt-confirmation', 'Disables confirmation after prompts')
    .option('--disable-saving', 'Disables saving config')
    .option('-h, --help', 'display help for command')
    .usage('<forge> <task> [options]')
    .helpOption(false)
    .helpCommand(false)
    .allowExcessArguments()
    .allowUnknownOption()
    .action(async (forgeId, taskId) => {
        if (commandRunning)
            return

        commandRunning = true

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

        await program.exitOverride().parseAsync()

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

const config = new Command('config')
    .description('Shows, sets or deletes config values of the current directory')

const getConfig = new Command('get')
const setConfig = new Command('set')
const deleteConfig = new Command('delete')
config
    .addCommand(getConfig)
    .addCommand(setConfig)
    .addCommand(deleteConfig)

getConfig
    .argument('<key>', 'The key of the config')
    .addOption(
        new Option('--scope <scope>', 'The scope of the config')
            .choices(['task', 'forge', 'project'])
    )
    .option('--forge <id>', 'The id of the forge in which the task belongs')
    .option('--task <id>', 'The id of the task')
    .option('--recursive', 'Also merges values with parent configs.')
    .action(async (key, options) => {
        if (!options.forge && (!options.scope || options.scope == 'task' || options.scope == 'forge')) {
            program.error('forge id is required')
        }

        if (!options.task && (!options.scope || options.scope == 'task')) {
            program.error('task id is required')
        }

        const value = await ConfigHandler.getConfig({
            directory: process.cwd(),
            key,
            scope: options.scope,
            forgeId: options.forge,
            taskId: options.task,
            recursive: options.recursive
        })
        console.log(value)
    })

setConfig
    .addArgument(
        new Argument('<scope>', 'The scope of the config')
            .choices(['task', 'forge', 'project'])
    )
    .argument('<key>', 'The key of the config')
    .argument('<value>', 'The value to set in the config')
    .option('--forge <id>', 'The id of the forge in which the task belongs')
    .option('--task <id>', 'The id of the task')
    .option('--as-json', 'Parses the value as a json')
    .action(async (scope, key, value, opts) => {
        if (!opts.forge && (scope == 'task' || scope == 'forge')) {
            program.error('forge id is required')
        }

        if (!opts.task && (scope == 'task')) {
            program.error('task id is required')
        }

        await ConfigHandler.setConfig({
            directory: process.cwd(),
            key: key,
            scope: scope,
            value: value,
            forgeId: opts.forge,
            taskId: opts.task
        })
    })

deleteConfig
    .addArgument(
        new Argument('<scope>', 'The scope of the config')
            .choices(['task', 'forge', 'project'])
    )
    .argument('<key>', 'The key of the config')
    .option('--forge <id>', 'The id of the forge in which the task belongs')
    .option('--task <id>', 'The id of the task')
    .action(async (scope, key, opts) => {
        if (!opts.forge && (scope == 'task' || scope == 'forge')) {
            program.error('forge id is required')
        }

        if (!opts.task && (scope == 'task')) {
            program.error('task id is required')
        }
        await ConfigHandler.deleteConfig({
            directory: process.cwd(),
            key: key,
            scope: scope,
            forgeId: opts.forge,
            taskId: opts.task
        })
    })

await program
    .addCommand(list)
    .addCommand(runCommand)
    .addCommand(installCommand)
    .addCommand(uninstallCommand)
    .addCommand(config)
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
    .action(async () => {
        const root = buildRootRoute(program)
        await runRoute(root)
    })
    .parseAsync()