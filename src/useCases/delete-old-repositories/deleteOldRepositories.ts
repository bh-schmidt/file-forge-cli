import { FileForgeData } from "file-forge";
import fs from 'fs-extra';

export async function deleteOldRepositories(config?: FileForgeData.ConfigObject) {
    const internalConfig = config === undefined
    config ??= await FileForgeData.readConfig()

    const allForges = Object.values(config.forges)
    const reposToDelete = config.repositories.filter(repo => !allForges.some(f => f.repositoryId == repo.id))

    for (const repo of reposToDelete) {
        const index = config.repositories.indexOf(repo)
        config.repositories.splice(index, 1)

        const repoDir = FileForgeData.getGitForgesPath(repo.id)
        if (await fs.exists(repoDir)) {
            await fs.rm(repoDir, { recursive: true })
        }
    }

    if (internalConfig) {
        await FileForgeData.saveConfig(config)
    }
}