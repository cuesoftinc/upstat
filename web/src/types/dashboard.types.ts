import { webTrafficData } from "@/data/dashboard.data"

export type statsDataType = {
    id: number,
    name: string,
    number: string,
    percent: string,
    chart: string,
    color: string,
}[]

export type totalUserDataType = {
    id: number,
    day: string,
    users: number | null
}[]

export type webTrafficDataType = {
    id: number,
    name: string,
    range: number,
}[]

export type deviceTrafficDataType = {
    id: number,
    device: string,
    traffic: number | null
}[]

export type locationTrafficDataType = {
    id: number,
    name: string,
    percent: number,
    color: string,
}[]