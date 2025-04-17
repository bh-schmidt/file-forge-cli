import { FileForgeData, PromptsHelper } from 'file-forge'
import fs from 'fs-extra'
import { join } from 'path'
import chalk from "chalk"
import { resolve } from "path"
import { deleteOldRepositories } from "../delete-old-repositories/deleteOldRepositories"

export async function installForgeDirectoryPrompt() {
    const config = await FileForgeData.readConfig()
    let forge: FileForgeData.ForgeInfo = undefined!

    const answers = await PromptsHelper.promptWithConfirmation([
        {
            name: 'directory',
            type: 'text',
            message: 'Inform the directory of the forge:',
            async validate(dir: string) {
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

                    forge = (await FileForgeData.readForgeDir(dir))!
                    if (!forge) {
                        return 'No forge found in this directory'
                    }
                } catch (error) {
                    return 'Invalid directory'
                }

                return true
            },
        },
        {
            name: 'replace',
            type: (_, values) => {
                const existingForge = config?.forges?.[forge.id]
                if (!existingForge)
                    return false

                if (existingForge.directory == resolve(values.directory)) {
                    return false
                }

                return 'confirm'

            },
            message: () => `Replace existing forge (${forge.id})?`
        },
        {
            name: 'rebuildStrategy',
            type: () => {
                if (forge.isTypescript)
                    return 'select'

                return false
            },
            message: 'Which will the rebuild strategy be?',
            choices: FileForgeData.rebuildStrategies.map(e => ({ title: e, value: e }))
        }
    ])

    const directory = resolve(answers.directory)
    const replace = answers.replace
    const rebuildStrategy = answers.rebuildStrategy

    const error = await validateDirectory(directory)
    if (typeof error === 'string') {
        console.log(chalk.red(error))
        return false
    }

    const existingForge = config.forges[forge.id]
    if (existingForge && existingForge.directory == directory && existingForge.rebuildStrategy == rebuildStrategy) {
        return true
    }

    if (existingForge && existingForge.directory !== directory && !replace) {
        console.log(chalk.red(`The forge ${forge.id} already exists`))
        return false
    }

    config.forges[forge.id] = {
        id: forge.id,
        directory: directory,
        rebuildStrategy: forge.isTypescript ?
            rebuildStrategy ?? 'dist-missing' :
            undefined
    }

    await deleteOldRepositories(config)
    await FileForgeData.saveConfig(config)

    return true
}

async function validateDirectory(dir: string) {

}