import chalk from "chalk"
import { HyperForgeData } from "hyper-forge"
import fs from 'fs-extra'
import { join, resolve } from "path"
import { deleteOldRepositories } from "../delete-old-repositories/deleteOldRepositories"

export interface InstallOptions {
    directory: string
    replace?: boolean
    rebuildStrategy?: HyperForgeData.RebuildStrategy
}

export async function installForgeDirectory(options: InstallOptions) {
    const directory = resolve(options.directory)

    const error = await validateDirectory(directory)
    if (typeof error === 'string') {
        console.log(chalk.red(error))
        return false
    }

    const config = await HyperForgeData.readConfig()
    const forge = await HyperForgeData.readForgeDir(directory)
    if (!forge) {
        console.log(chalk.red(`No forge found in this directory`))
        return false
    }

    const existingForge = config.forges[forge.id]
    if (existingForge && existingForge.directory == directory && existingForge.rebuildStrategy == options.rebuildStrategy) {
        return true
    }

    if (existingForge && existingForge.directory != directory && !options.replace) {
        console.log(chalk.red(`The forge ${forge.id} already exists`))
        return false
    }

    config.forges[forge.id] = {
        id: forge.id,
        directory: directory,
        rebuildStrategy: forge.isTypescript ?
            options.rebuildStrategy ?? 'dist-missing' :
            undefined
    }

    await deleteOldRepositories(config)
    await HyperForgeData.saveConfig(config)

    return true
}

async function validateDirectory(dir: string) {
    if (!dir || dir.trim() === '') {
        return 'Directory is required'
    }

    try {
        if (!await fs.exists(dir)) {
            return 'Directory does not exist'
        }

        const packageJson = join(dir, 'package.json')
        if (!await fs.exists(packageJson)) {
            return 'There is no package.json in this directory'
        }

        const json = await fs.readJson(packageJson)
        if (!json?.name) {
            return 'The package.json has no name'
        }
    } catch (error) {
        return 'Invalid directory'
    }

    return true
}