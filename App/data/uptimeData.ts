export const systemData: {
    name: string,
    percent: number,
    status: any[],
    final: string
}[] = [
    {
        name: "API",
        percent: 98,
        status: new Array(30).fill(0),
        final: "Up"
    },
    {
        name: "Website",
        percent: 93,
        status: new Array(30).fill(0),
        final: "Up"
    },
    {
        name: "Server",
        percent: 91,
        status: new Array(30).fill(0),
        final: "Up"
    },
    {
        name: "Blog",
        percent: 32,
        status: new Array(30).fill(0),
        final: "Dn"
    },
]