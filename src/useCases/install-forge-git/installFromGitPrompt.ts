import { execa } from "execa";
import { FileForgeData, PromptsHelper } from "file-forge";
import fs from 'fs-extra';
import { cloneRepository } from "./internal/cloneRepository";
import chalk from "chalk";
import { getAvailableForges } from "./internal/getAvailableForges";
import { getForgesToReplace } from "./internal/getForgesToReplace";
import lodash from "lodash";
import { deleteOldRepositories } from "../delete-old-repositories/deleteOldRepositories";

interface InstallOptions {
    repository: string
    branch?: string
    commit?: string
}

export async function installFromGitPrompt() {
    const answers = await PromptsHelper.promptWithConfirmation([
        {
            name: 'repository',
            type: 'text',
            message: 'Inform the repository:',
            async validate(repo: string) {
                if (!repo || repo.trim() == '')
                    return 'Repository is required.'

                const { failed } = await execa('git ls-remote', [repo], { reject: false })
                if (failed) {
                    return 'Repository does not exist.'
                }

                return true
            }
        },
        {
            name: 'branch',
            type: 'text',
            message: 'Inform the branch:',
            initial: 'master/main',
            async validate(branch, answers) {
                if (branch == 'master/main') {
                    return true
                }

                const { failed } = await execa('git ls-remote --heads', [answers.repository, branch], { reject: false })
                if (failed) {
                    return 'Repository does not exist.'
                }

                return true
            }
        },
        {
            name: 'commit',
            type: 'text',
            message: 'Inform the commit:',
            initial: 'latest',
        }
    ])

    const options: InstallOptions = {
        repository: answers.repository,
        branch: answers.branch == 'master/main' ?
            undefined :
            answers.branch,
        commit: answers.commit == 'latest' ?
            undefined :
            answers.commit,
    }

    let repository: FileForgeData.ClonedRepositories | undefined
    let repositoryExists = false
    try {
        const config = await FileForgeData.readConfig()
        repository = await cloneRepository(options, config)
        if (!repository) {
            return false
        }

        repositoryExists = config.repositories.some(e => e.id == repository!.id)

        const success = await installInternal(repository, config, options)

        if (!success) {
            const path = FileForgeData.getGitForgesPath(repository.id)
            if (!repositoryExists && await fs.exists(path)) {
                await fs.rm(path, { recursive: true })
            }

            return false
        }

        if (!repositoryExists) {
            config.repositories.push(repository)
        }

        await deleteOldRepositories(config)
        await FileForgeData.saveConfig(config)

        return true
    } catch (error) {
        console.log(chalk.red('An error ocurred:'))
        console.log(error)

        if (repository) {
            const path = FileForgeData.getGitForgesPath(repository.id)
            if (!repositoryExists && await fs.exists(path)) {
                await fs.rm(path, { recursive: true })
            }
        }

        return false
    }
}

async function installInternal(repository: FileForgeData.ClonedRepositories, config: FileForgeData.ConfigObject, options: InstallOptions) {
    const repositoryExists = config.repositories.some(e => e.id == repository.id)
    const availableForges = await getAvailableForges(repository, config)
    if (availableForges.length == 0) {
        if (repositoryExists) {
            console.log(chalk.yellow('All forges of this repository are already installed.'))
        }
        else {
            console.log(chalk.red('No available forges found in this repository.'))
        }

        return false
    }

    const { selections } = await PromptsHelper.promptWithConfirmation([{
        name: 'selections',
        type: 'multiselect',
        message: 'Select the forges to install:',
        choices: availableForges.map(e => {
            return {
                title: e.id
            }
        })
    }])
    const selectedForges = selections as number[]
    if (selectedForges.length == 0) {
        console.log(chalk.yellow('No forge selected.'))
        return false
    }

    const forgesToInstall = selectedForges.map((e: number) => availableForges[e])
    const forgesToReplace = await getForgesToReplace(forgesToInstall, repository, config)
    if (forgesToReplace.length > 0) {
        const text = forgesToReplace.map(e => e.id).join('\n\t')

        const { replace } = await PromptsHelper.promptWithConfirmation({
            name: 'replace',
            type: 'confirm',
            message: `The following forges are already installed:\n\t${text}\nReplace them?`
        })

        if (!replace) {
            for (const forge of forgesToReplace) {
                lodash.remove(forgesToInstall, f => f.id == forge.id)
            }
        }
    }

    if (forgesToInstall.length == 0) {
        console.log(chalk.yellow('No forges to install.'))
        return false
    }

    for (const forge of forgesToInstall) {
        config.forges[forge.id] = {
            id: forge.id,
            directory: forge.directory,
            repositoryId: repository.id,
            rebuildStrategy: forge.isTypescript ?
                'dist-missing' :
                undefined
        }
    }

    return true
}