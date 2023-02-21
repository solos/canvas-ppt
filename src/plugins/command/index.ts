import { CLIPBOARD_STRING_TYPE, copyText, pasteCustomClipboardString, readClipboard } from "@/utils/clipboard";
import { createImageElement, createRandomCode } from "@/utils/create";
import { encrypt } from "@/utils/crypto";
import { History } from "../editor/history";
import { KeyMap } from "../shortCut/keyMap";
import StageConfig, { TEXT_MARGIN } from "../stage/config";
import { Cursor } from "../stage/cursor";
import { IPPTElement, IPPTElementOutline, IPPTImageElement, IPPTShapeElement, IPPTTextElement } from "../types/element";
import { IFontData } from "../types/font";

export default class Command {
    private _stageConfig: StageConfig;
    private _history: History;
    private _cursor: Cursor;

    private _updateDebounce: null | number;
    constructor(stageConfig: StageConfig, history: History, cursor: Cursor) {
        this._stageConfig = stageConfig;
        this._history = history;
        this._cursor = cursor;

        this._updateDebounce = null;
    }

    public getZoom() {
        return this._stageConfig.zoom;
    }

    // 适配
    public executeFitZoom() {
        this._stageConfig.resetBaseZoom();
    }

    // 缩小
    public executeDecrease() {
        const minZoom = this._stageConfig.getFitZoom();
        const zoom = this.getZoom();

        if (zoom - 0.05 >= minZoom) {
            this._stageConfig.setZoom(zoom - 0.05);
        } else if (zoom > minZoom) {
            this._stageConfig.setZoom(minZoom);
        }
    }

    // 放大
    public executeIncrease() {
        const zoom = this.getZoom();

        // 考虑是否要加上限
        this._stageConfig.setZoom(zoom + 0.05);
    }

    // 上移一层
    public executeMoveUp() {
        const operateElement = this._stageConfig.operateElement;
        if (operateElement) {
            const slide = this._stageConfig.getCurrentSlide();
            const zIndex = slide?.elements.findIndex(element => element.id === operateElement.id);
            if (slide && slide.elements && typeof zIndex !== "undefined" && zIndex > -1) {
                // 已经处在顶层，无法继续移动
                if (zIndex === slide.elements.length - 1) return;

                // 移动
                const movedElement = slide.elements.splice(zIndex, 1)[0];
                slide.elements.splice(zIndex + 1, 0, movedElement);

                this.executeLogRender();
            }
        }
    }

    // 下移一层
    public executeMoveDown() {
        const operateElement = this._stageConfig.operateElement;
        if (operateElement) {
            const slide = this._stageConfig.getCurrentSlide();
            const zIndex = slide?.elements.findIndex(element => element.id === operateElement.id);
            if (slide && slide.elements && typeof zIndex !== "undefined" && zIndex > -1) {
                // 已经处在底，无法继续移动
                if (zIndex === 0) return;

                // 移动
                const movedElement = slide.elements.splice(zIndex, 1)[0];
                slide.elements.splice(zIndex - 1, 0, movedElement);

                this.executeLogRender();
            }
        }
    }

    // 置于顶层
    public executeMoveTop() {
        const operateElement = this._stageConfig.operateElement;
        if (operateElement) {
            const slide = this._stageConfig.getCurrentSlide();
            const zIndex = slide?.elements.findIndex(element => element.id === operateElement.id);
            if (slide && slide.elements && typeof zIndex !== "undefined" && zIndex > -1) {
                // 已经处在顶层，无法继续移动
                if (zIndex === slide.elements.length - 1) return;

                // 移动
                const movedElement = slide.elements.splice(zIndex, 1)[0];
                slide.elements.push(movedElement);

                this.executeLogRender();
            }
        }
    }

    // 置于底层
    public executeMoveBottom() {
        const operateElement = this._stageConfig.operateElement;
        if (operateElement) {
            const slide = this._stageConfig.getCurrentSlide();
            const zIndex = slide?.elements.findIndex(element => element.id === operateElement.id);
            if (slide && slide.elements && typeof zIndex !== "undefined" && zIndex > -1) {
                // 已经处在底，无法继续移动
                if (zIndex === 0) return;

                // 移动
                const movedElement = slide.elements.splice(zIndex, 1)[0];
                slide.elements.unshift(movedElement);

                this.executeLogRender();
            }
        }
    }

    // 水平翻转
    public executeFlipH() {
        const operateElement = this._stageConfig.operateElement as IPPTImageElement | IPPTShapeElement;
        if (operateElement) {
            const newElement: IPPTElement = {
                ...operateElement,
                flipH: operateElement.flipH === -1 ? 1 : -1
            };

            this.executeUpdateRender(newElement, true);
        }
    }

    // 垂直翻转
    public executeFlipV() {
        const operateElement = this._stageConfig.operateElement as IPPTImageElement | IPPTShapeElement;
        if (operateElement) {
            const newElement: IPPTElement = {
                ...operateElement,
                flipV: operateElement.flipV === -1 ? 1 : -1
            };

            this.executeUpdateRender(newElement, true);
        }
    }

    // 设置填充色
    public executeFillColor(color: string) {
        const operateElement = this._stageConfig.operateElement as IPPTShapeElement;
        if (operateElement) {
            const newElement = {
                ...operateElement,
                fill: color
            };

            this.executeUpdateRender(newElement, true);
        }
    }

    // 填充透明度设置
    public executeOpacity(value: number) {
        const operateElement = this._stageConfig.operateElement as IPPTShapeElement | IPPTImageElement;
        if (operateElement) {
            const newElement = {
                ...operateElement,
                opacity: value
            };

            this.executeUpdateRender(newElement, true);
        }
    }

    // 修改边框
    public executeOutline(outline?: IPPTElementOutline) {
        const operateElement = this._stageConfig.operateElement as IPPTShapeElement;
        if (operateElement) {
            const newElement = {
                ...operateElement,
                outline
            };

            if (!outline) delete newElement.outline;

            this.executeUpdateRender(newElement, true);
        }
    }

    // 复制
    public async executeCopy() {
        const operateElement = this._stageConfig.operateElement;
        // 选中元素时
        if (operateElement) {
            // 将元素json数据加密存入剪切板
            await copyText(encrypt(`${CLIPBOARD_STRING_TYPE.ELEMENT}${JSON.stringify(operateElement)}`));
        }
    }

    // 剪切
    public async executeCut() {
        await this.executeCopy();
        await this.executeDelete();
    }

    // 粘贴
    public async executePaste() {
        const content = await readClipboard();
        if (content.indexOf(CLIPBOARD_STRING_TYPE.ELEMENT) > -1) {
            // 粘贴的内容为元素数据
            const resultText = content.replace(CLIPBOARD_STRING_TYPE.ELEMENT, "");
            const element = pasteCustomClipboardString(resultText) as IPPTElement;
            // 粘贴的内容为元素数据
            element.id = createRandomCode();
            // 新元素较旧元素偏移一段距离
            element.left += 10;
            element.top += 10;

            this.executeAddRender(element);

            // 再次写入剪切板，为了下一次粘贴能够在上一次的基础上进行偏移
            await copyText(encrypt(`${CLIPBOARD_STRING_TYPE.ELEMENT}${JSON.stringify(element)}`));
        } else if (content.indexOf(CLIPBOARD_STRING_TYPE.IMAGE) > -1) {
            // 粘贴外来图片
            const image = new Image();
            image.onload = () => {
                const element = createImageElement(
                    image.width,
                    image.height,
                    content
                );
                this.executeAddRender(element);
            };
            image.src = content;
        }
    }

    // 删除元素
    public executeDelete() {
        const operateElement = this._stageConfig.operateElement;
        if (operateElement) {
            this.executeDeleteRender(operateElement);
        }
    }

    // 选中位置字体更新字体样式配置
    public executeUpdateFontConfig() {
        // 获取前一个字的样式，设置config
        const operateElement = this._stageConfig.operateElement as IPPTTextElement;
        if (operateElement && this._stageConfig.textFocus) {
            const currentDataPosition = this._cursor.getDataPosition();
            const content = operateElement.content;
            const text = currentDataPosition === -1 ? this._stageConfig.fontConfig : content[currentDataPosition];

            const config = {
                fontSize: text.fontSize,
                fontColor: text.fontColor,
                fontFamily: text.fontFamily,
                fontStyle: text.fontStyle,
                fontWeight: text.fontWeight,
                underline: !!text.underline,
                strikout: !!text.strikout
            };
            this._stageConfig.setFontConfig(config);
        }
    }

    // 元素移动 及 光标移动
    public executeMove(direction: string) {
        const operateElement = this._stageConfig.operateElement;
        if (operateElement) {
            if (this._stageConfig.textFocus) {
                // 光标移动
                switch (direction) {
                    case KeyMap.Up: {
                        const position = this._cursor.getDataPosition();
                        const renderPosition = this._cursor.getRenderDataPosition();
                        if (renderPosition[0] > 0) {
                            const renderContent = this._stageConfig.getRenderContent(operateElement as IPPTTextElement);

                            const currentLineData = renderContent[renderPosition[0]];
                            let currentLeft = this._stageConfig.getAlignOffsetX(currentLineData, operateElement as IPPTTextElement);
                            for (const [index, data] of currentLineData.texts.entries()) {
                                if (index <= renderPosition[1]) {
                                    currentLeft += data.width;
                                }
                            }

                            const upLineData = renderContent[renderPosition[0] - 1];
                            let upLineX = -1;
                            let upLeft = this._stageConfig.getAlignOffsetX(upLineData, operateElement as IPPTTextElement);
                            for (const data of upLineData.texts) {
                                if (upLeft <= currentLeft) {
                                    upLineX++;
                                    upLeft += data.width;
                                } else {
                                    break;
                                }
                            }

                            // 处理光标在行首的情况
                            if (upLineX === -1) upLineX = 0;

                            this._cursor.setDataPosition(position - (renderPosition[1] + 1 + upLineData.texts.length - upLineX));
                            this._cursor.setCursorPositionByData();
                            this._cursor.updateCursor();

                            this.executeUpdateFontConfig();
                        }
                        break;
                    }
                    case KeyMap.Down: {
                        const position = this._cursor.getDataPosition();
                        const renderPosition = this._cursor.getRenderDataPosition();
                        const renderContent = this._stageConfig.getRenderContent(operateElement as IPPTTextElement);
                        if (renderPosition[0] < renderContent.length - 1) {
                            const currentLineData = renderContent[renderPosition[0]];
                            let currentLeft = this._stageConfig.getAlignOffsetX(currentLineData, operateElement as IPPTTextElement);
                            for (const [index, data] of currentLineData.texts.entries()) {
                                if (index <= renderPosition[1]) {
                                    currentLeft += data.width;
                                }
                            }

                            const downLineData = renderContent[renderPosition[0] + 1];
                            let downLineX = -1;
                            let downLeft = this._stageConfig.getAlignOffsetX(downLineData, operateElement as IPPTTextElement);
                            for (const data of downLineData.texts) {
                                if (downLeft <= currentLeft) {
                                    downLineX++;
                                    downLeft += data.width;
                                } else {
                                    break;
                                }
                            }

                            // 处理光标在行首的情况
                            if (downLineX === -1) downLineX = 0;

                            this._cursor.setDataPosition(position + (currentLineData.texts.length - (renderPosition[1] + 1) + downLineX));
                            this._cursor.setCursorPositionByData();
                            this._cursor.updateCursor();

                            this.executeUpdateFontConfig();
                        }
                        break;
                    }
                    case KeyMap.Left: {
                        const position = this._cursor.getDataPosition();
                        this._cursor.setDataPosition(position - 1);
                        this._cursor.setCursorPositionByData();
                        this._cursor.updateCursor();

                        this.executeUpdateFontConfig();
                        break;
                    }
                    case KeyMap.Right: {
                        const position = this._cursor.getDataPosition();
                        this._cursor.setDataPosition(position + 1);
                        this._cursor.setCursorPositionByData();
                        this._cursor.updateCursor();

                        this.executeUpdateFontConfig();
                        break;
                    }
                }
            } else {
                // 元素移动
                switch (direction) {
                    case KeyMap.Up: {
                        operateElement.top = Math.floor(operateElement.top - 1);
                        break;
                    }
                    case KeyMap.Down: {
                        operateElement.top = Math.ceil(operateElement.top + 1);
                        break;
                    }
                    case KeyMap.Left: {
                        operateElement.left = Math.floor(operateElement.left - 1);
                        break;
                    }
                    case KeyMap.Right: {
                        operateElement.left = Math.ceil(operateElement.left + 1);
                        break;
                    }
                }

                this.executeUpdateRender(operateElement);

                // 更新记录做防抖延迟
                if (this._updateDebounce) {
                    clearTimeout(this._updateDebounce);
                    this._updateDebounce = null;
                }

                this._updateDebounce = setTimeout(() => {
                    this.executeLogRender();
                    this._updateDebounce = null;
                }, 1000);
            }
        }
    }

    // 渲染
    public executeRender() {
        this._stageConfig.resetCheckDrawOprate();
        this._stageConfig.resetCheckDrawView();
    }

    // 元素历史记录并渲染
    public executeLogRender() {
        this._history.add();

        this.executeRender();
    }

    // 元素更新及渲染
    public executeUpdateRender(element: IPPTElement, addHistory?: boolean) {
        this._stageConfig.setOperateElement(element);
        this._stageConfig.updateElement(element);

        if (addHistory) {
            this.executeLogRender();
        } else {
            this.executeRender();
        }
    }

    // 元素新增及渲染
    public executeAddRender(element: IPPTElement) {
        this._stageConfig.addElement(element);
        this._stageConfig.setOperateElement(element);

        this.executeLogRender();
    }

    // 元素删除及渲染
    public executeDeleteRender(element: IPPTElement) {
        const slide = this._stageConfig.getCurrentSlide();
        const index = slide?.elements.findIndex(ele => ele.id === element.id);
        if (typeof index !== "undefined" && index > -1) {
            slide?.elements.splice(index, 1);
            this._stageConfig.setOperateElement(null);

            this.executeLogRender();
        }
    }

    // 文本输入
    public executeAddText(text: IFontData, position: number) {
        const operateElement = this._stageConfig.operateElement as IPPTTextElement;
        if (operateElement) {
            operateElement.content.splice(position, 0, text);
            const renderContent = this._stageConfig.getRenderContent(operateElement);
            let height = TEXT_MARGIN * 2;
            renderContent.forEach(line => {
                height += line.height * operateElement.lineHeight;
            });
            operateElement.height = height;

            this.executeUpdateRender(operateElement, true);
        }
    }
}
