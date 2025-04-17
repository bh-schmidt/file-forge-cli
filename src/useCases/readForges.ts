import { FileForgeData } from "file-forge"

let readForgesPromise: Promise<FileForgeData.ForgeInfo[]> | undefined = undefined
let forges: FileForgeData.ForgeInfo[] | undefined

export async function readForges() {
    const promise = FileForgeData.readForges()
    readForgesPromise = promise

    forges = await promise
    if (promise == readForgesPromise)
        readForgesPromise = undefined
}

export async function getForges() {
    if (readForgesPromise) {
        await readForgesPromise
    }

    return [...forges!]
}