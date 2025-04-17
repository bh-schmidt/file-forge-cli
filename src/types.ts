
export interface BaseRoute {
    title: string
    description?: string
    id: any
}

export interface TaskRoute extends BaseRoute {
    execute(): void | Promise<void>
}

export type RouteItem = Route | TaskRoute

export type RouteItems = RouteItem[] | (() => RouteItem[] | Promise<RouteItem[]>)

export interface Route extends BaseRoute {
    question: string
    type: 'select' | 'autocomplete'
    items: RouteItems
}