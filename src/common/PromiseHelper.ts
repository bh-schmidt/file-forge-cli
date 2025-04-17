export namespace PromiseHelper {
    export function delay(ms: number) {
        return new Promise<void>(r => setTimeout(() => {
            r()
        }, ms))
    }
}