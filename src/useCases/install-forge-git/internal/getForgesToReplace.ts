import { FileForgeData } from "file-forge";

export async function getForgesToReplace(forges: FileForgeData.ForgeInfo[], repository: FileForgeData.ClonedRepositories, config: FileForgeData.ConfigObject) {
    return forges.filter(f => f.id in config.forges && config.forges[f.id].repositoryId != repository.id)
}