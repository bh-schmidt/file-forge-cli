import chalk from "chalk";
import { HyperForgeData } from "hyper-forge";
import fs from 'fs-extra';
import { cloneRepository } from "./internal/cloneRepository";
import { getAvailableForges } from "./internal/getAvailableForges";
import { getForgesToInstall } from "./internal/getForgesToInstall";
import { getForgesToReplace } from "./internal/getForgesToReplace";
import { deleteOldRepositories } from "../delete-old-repositories/deleteOldRepositories";

export interface InstallOptions {
    repository: string
    forgeIds?: string[]
    branch?: string
    commit?: string
    replace?: boolean
}

export async function installFromGit(options: InstallOptions) {
    let repository: HyperForgeData.ClonedRepositories | undefined
    let repositoryExists = false
    try {
        const config = await HyperForgeData.readConfig()
        repository = await cloneRepository(options, config)
        if (!repository) {
            return false
        }

        repositoryExists = config.repositories.some(e => e.id == repository!.id)

        const success = await installInternal(repository, config, options)

        if (!success) {
            const path = HyperForgeData.getGitForgesPath(repository.id)
            if (!repositoryExists && await fs.exists(path)) {
                await fs.rm(path, { recursive: true })
            }

            return false
        }

        if (!repositoryExists) {
            config.repositories.push(repository)
        }

        await deleteOldRepositories(config)
        await HyperForgeData.saveConfig(config)

        return true
    } catch (error) {
        console.log(chalk.red('An error ocurred:'))
        console.log(error)

        if (repository) {
            const path = HyperForgeData.getGitForgesPath(repository.id)
            if (!repositoryExists && await fs.exists(path)) {
                await fs.rm(path, { recursive: true })
            }
        }

        return false
    }
}

async function installInternal(repository: HyperForgeData.ClonedRepositories, config: HyperForgeData.ConfigObject, options: InstallOptions) {
    const availableForges = await getAvailableForges(repository, config)
    if (availableForges.length == 0) {
        console.log(chalk.red('No available forges found in this repository.\n'))
        return false
    }

    const forgesToInstall = await getForgesToInstall(availableForges, options.forgeIds)
    if (forgesToInstall.length == 0) {
        console.log(chalk.yellow('No forge selected.\n'))
        return false
    }

    const forgesToReplace = await getForgesToReplace(forgesToInstall, repository, config)
    if (forgesToReplace.length > 0 && !options.replace) {
        const text = forgesToReplace.map(e => e.id).join('\n\t')
        console.log(chalk.red('There following forges conflict with already installed forges:'))
        console.log('\t' + text)
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