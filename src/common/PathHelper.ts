export namespace PathHelper {
    export function fileToName(fileName: string) {
        return fileName
            .replaceAll(/[-_. ](.)/g, (_, group: string) => {
                return ' ' + group.toUpperCase()
            })
            .replaceAll(/[^\w ]/g, '')
            .replace(/^./, (m) => {
                return m.toUpperCase()
            })
    }
}