
export type topsectionProp = {
    system : string,
    back: boolean
}

export type systemDataType = {
    name: string,
    percent: number,
    status: (1 | 0)[],
}[]

export type systemProps = {
    name: string, 
    percent: number, 
    allStatus: (0 | 1)[]
}

export type statusBarProp = {
    allStatus: (0 | 1)[]
}

export type uptimeStatProp = {
    data: systemDataType
}