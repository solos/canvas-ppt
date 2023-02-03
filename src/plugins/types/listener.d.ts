import { IPPTElement } from "./element";

export type IOnZoomChange = (zoom: number) => void;

export type IOnEditChange = (cursor: number, length: number, slideId: string) => void;

export type IOnSelectedChange = (element: IPPTElement | null) => void;
