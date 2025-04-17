import { FileForgeData, GlobHelper } from "file-forge";

export async function getAvailableForges(repository: FileForgeData.ClonedRepositories, config: FileForgeData.ConfigObject) {
    const clonePath = FileForgeData.getGitForgesPath(repository.id)
    const rootForge = await GlobHelper.exists('package.json', { cwd: clonePath })
    const foundPaths: string[] = []

    if (rootForge) {
        foundPaths.push(clonePath)
    } else {
        const dirs = GlobHelper.globAll('*', {
            cwd: clonePath,
            nofiles: true,
            absolute: true
        })

        for await (const dir of dirs) {
            foundPaths.push(dir)
        }
    }

    const availableForges: FileForgeData.ForgeInfo[] = []
    for (const path of foundPaths) {
        const forge = await FileForgeData.readForgeDir(path)
        if (!forge) {
            continue
        }

        if (forge.id in config.forges && config.forges[forge.id].repositoryId == repository.id) {
            continue
        }

        availableForges.push(forge)
    }

    return availableForges
}
