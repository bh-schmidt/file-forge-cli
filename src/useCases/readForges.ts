import { HyperForgeData } from "hyper-forge"

let readForgesPromise: Promise<HyperForgeData.ForgeInfo[]> | undefined = undefined
let forges: HyperForgeData.ForgeInfo[] | undefined

export async function readForges() {
    const promise = HyperForgeData.readForges()
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