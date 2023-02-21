import { IFontData, ILineData } from "@/plugins/types/font";
import StageConfig from "../config";
import { Data, TEXT_MARGIN } from "./data";
import { Textarea } from "./Textarea";

const COMPENSTATE_LEN = 4;

export class Cursor {
    private _container: HTMLDivElement;
    private _cursor: HTMLDivElement | null;
    private _textarea: Textarea;

    private _data: Data;
    private _stageConfig: StageConfig;

    // 坐标位置
    private _height: number;
    private _top: number;
    private _left: number;

    // 渲染数据索引位置
    private _renderDataPosition: [number, number];

    // 原数据索引位置 -1 为最前面 之后值为数据索引值 及光标在该索引数据后面
    private _dataPosition: number;
    constructor(container: HTMLDivElement, stageConfig: StageConfig, data: Data, textarea: Textarea) {
        this._container = container;
        this._stageConfig = stageConfig;
        this._cursor = null;

        this._data = data;
        this._textarea = textarea;

        const config = this._data.config;

        this._height = this._data.lineHeight * config.fontSize + COMPENSTATE_LEN;
        this._top = this._data.elementLeft + TEXT_MARGIN - COMPENSTATE_LEN / 2 + 1;
        this._left = this._data.elementTop + TEXT_MARGIN - this._data.wordSpace / 2 - 0.5; // 0.5为光标宽度补偿值

        this._dataPosition = -1;
        this._renderDataPosition = [-1, 0];

        this._createCursor();
        this.updateCursor();
    }

    private _createCursor() {
        const cursor = document.createElement("div");
        cursor.style.width = "1px";
        cursor.style.position = "absolute";
        cursor.style.background = "black";
        cursor.style.display = "none";
        cursor.style.userSelect = "none";
        cursor.classList.add("editor-cursor");

        this._cursor = cursor;
        this._container.append(cursor);
    }

    hideCursor() {
        this._cursor!.style.display = "none";
    }

    showCursor() {
        this._cursor!.style.display = "block";
    }

    updateCursor() {
        if (!this._cursor) return;
        const element = this._data.element;
        if (!element) return;
        const { x, y } = this._stageConfig.getStageArea();
        const renderContent = this._stageConfig.getRenderContent(element);
        this.setCursorHeight(this._data.config.fontSize);
        renderContent.forEach((line, index) => {
            if (index === this._renderDataPosition[0] || (index === 0 && this._renderDataPosition[0] === -1)) {
                this.setCursorHeight(line.height);
            }
        });

        const left = (this._data.elementLeft + this._left) * this._data.zoom + x;
        const top = (this._data.elementTop + this._top) * this._data.zoom + y;
        const height = this._height * this._data.zoom;
        this._cursor.style.left = `${left}px`;
        this._cursor.style.top = `${top}px`;
        this._cursor.style.height = `${height}px`;

        // 更新textarea到光标位置
        this._textarea.setTextareaPosition(left, top + height / 2);
    }

    getCursorPosition(x: number, y: number, renderContent: ILineData[]) {
        const element = this._data.element;
        if (!element) return { left: 0, textX: 0, top: 0, textY: 0 };
        // 先计算属于哪一行
        const { top, textY } = this._getTextYCursorPosition(renderContent, y);

        // 计算在某行的位置
        const line = renderContent.length > 0 ? renderContent[textY] : { texts: [], width: 0, height: 0 } as ILineData;
        const lineData = line.texts;
        const offsetX = this._stageConfig.getAlignOffsetX(line, element);
        const { left, textX } = this._getTextXCursorPosition(lineData, x - offsetX);

        this._renderDataPosition = [textY, textX];

        return { left: left + offsetX, textX, top, textY };
    }

    setCursorPosition(x: number, y: number) {
        const element = this._data.element;
        if (!element) return;
        const renderContent = this._stageConfig.getRenderContent(element);

        const { left, textX, top, textY } = this.getCursorPosition(x, y, renderContent);
        this._top = top;
        this._left = left;

        let allDataIndex = 0;
        renderContent.forEach((lineData, index) => {
            if (index < textY) allDataIndex += lineData.texts.length;
        });

        this.setDataPosition(allDataIndex + textX);
    }

    setCursorPositionByData() {
        const { top, left } = this._getLineCursorPositionByData();
        this._left = left;
        this._top = top;
    }

    private _getLineCursorPositionByData() {
        const element = this._data.element;
        if (!element) return { top: 0, left: 0 };
        let top = TEXT_MARGIN - COMPENSTATE_LEN / 2 + 1;
        let left = TEXT_MARGIN - this._data.wordSpace / 2 - 0.5;
        const renderContent = this._stageConfig.getRenderContent(element);

        if (renderContent.length > 0) {
            for (const [lineY, line] of renderContent.entries()) {
                if (this._renderDataPosition[0] === lineY) {
                    break;
                } else {
                    top = top + line.height * this._data.lineHeight;
                }
            }
            const line = renderContent[this._renderDataPosition[0]];
            let offsetX = 0;

            if (line) {
                for (const [lineX, data] of line.texts.entries()) {
                    if (this._renderDataPosition[1] < lineX) {
                        break;
                    } else {
                        left = left + data.width + this._data.wordSpace;
                    }
                }

                offsetX = this._stageConfig.getAlignOffsetX(line, element);
            }

            left = left + offsetX;
        }

        return { top, left };
    }

    private _getTextYCursorPosition(renderContent: ILineData[], y: number) {
        let top = TEXT_MARGIN - COMPENSTATE_LEN / 2 + 1;
        let textY = 0;
        const len = renderContent.length;
        for (const [index, line] of renderContent.entries()) {
            if (y < top + line.height * this._data.lineHeight) {
                break;
            } else {
                if (index + 1 < len) {
                    textY++;
                    top = top + line.height * this._data.lineHeight;
                }
            }
        }
        return { top, textY };
    }

    private _getTextXCursorPosition(lineData: IFontData[], x: number) {
        let left = TEXT_MARGIN - this._data.wordSpace / 2 - 0.5;
        let textX = -1;
        for (const data of lineData) {
            if (x < left + data.width / 2) {
                break;
            } else {
                textX++;
                left = left + data.width + this._data.wordSpace;
            }
        }
        // 处于最右一位的时候因为回车符减掉1
        if (textX === lineData.length - 1) textX--;
        return { left, textX };
    }

    setCursorHeight(height: number) {
        this._height = height * this._data.lineHeight;
    }

    setRenderDataPosition() {
        const element = this._data.element;
        if (!element) return;
        if (this._dataPosition === -1) {
            this._renderDataPosition = [0, -1];
        } else {
            const renderContent = this._stageConfig.getRenderContent(element);
            let x = 0;
            for (const [line, lineData] of renderContent.entries()) {
                // 减一是去掉回车符 当行元素只有一个的时候为只有回车符
                if (this._dataPosition < x + lineData.texts.length - 1) {
                    this._renderDataPosition = [line, this._dataPosition - x];
                    break;
                } else {
                    x = x + lineData.texts.length;
                }
            }
        }
    }

    getRenderDataPosition() {
        return this._renderDataPosition;
    }

    setDataPosition(position: number) {
        if (position < -1 || position >= this._data.getLength() - 1) return;
        this._dataPosition = position;
        this.setRenderDataPosition();
    }

    getDataPosition() {
        return this._dataPosition;
    }
}
