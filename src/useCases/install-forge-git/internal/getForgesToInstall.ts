import { FileForgeData } from "file-forge"

export async function getForgesToInstall(availableForges: FileForgeData.ForgeInfo[], forgeIds: string[] | undefined) {
    if (!forgeIds) {
        return availableForges
    }

    if (forgeIds.some(e => e == '*'))
        return availableForges

    return availableForges.filter(e => forgeIds!.includes(e.id))
}
