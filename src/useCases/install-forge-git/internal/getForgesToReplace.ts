import { HyperForgeData } from "hyper-forge";

export async function getForgesToReplace(forges: HyperForgeData.ForgeInfo[], repository: HyperForgeData.ClonedRepositories, config: HyperForgeData.ConfigObject) {
    return forges.filter(f => f.id in config.forges && config.forges[f.id].repositoryId != repository.id)
}