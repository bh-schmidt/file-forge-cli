import { HyperForgeData } from "hyper-forge"

export async function getForgesToInstall(availableForges: HyperForgeData.ForgeInfo[], forgeIds: string[] | undefined) {
    if (!forgeIds) {
        return availableForges
    }

    if (forgeIds.some(e => e == '*'))
        return availableForges

    return availableForges.filter(e => forgeIds!.includes(e.id))
}
