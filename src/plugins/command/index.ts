import { copyText, readClipboard } from "@/utils/clipboard";
import { createRandomCode } from "@/utils/create";
import { encrypt } from "@/utils/crypto";
import { History } from "../editor/history";
import StageConfig from "../stage/config";
import { IPPTElement, IPPTImageElement, IPPTLineElement, IPPTShapeElement } from "../types/element";

export default class Command {
    private _stageConfig: StageConfig;
    private _history: History;
    constructor(stageConfig: StageConfig, history: History) {
        this._stageConfig = stageConfig;
        this._history = history;
    }

    public getZoom() {
        return this._stageConfig.zoom;
    }

    // 适配
    public excuteFitZoom() {
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

                this._history.add();

                this._stageConfig.resetCheckDrawOprate();
                this._stageConfig.resetCheckDrawView();
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

                this._history.add();

                this._stageConfig.resetCheckDrawOprate();
                this._stageConfig.resetCheckDrawView();
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

                this._history.add();

                this._stageConfig.resetCheckDrawOprate();
                this._stageConfig.resetCheckDrawView();
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

                this._history.add();

                this._stageConfig.resetCheckDrawOprate();
                this._stageConfig.resetCheckDrawView();
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

            this._stageConfig.setOperateElement(newElement);
            this._stageConfig.updateElement(newElement);

            this._history.add();

            this._stageConfig.resetCheckDrawOprate();
            this._stageConfig.resetCheckDrawView();
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

            this._stageConfig.setOperateElement(newElement);
            this._stageConfig.updateElement(newElement);

            this._history.add();

            this._stageConfig.resetCheckDrawOprate();
            this._stageConfig.resetCheckDrawView();
        }
    }

    // 复制
    public async excuteCopy() {
        const operateElement = this._stageConfig.operateElement;
        // 选中元素时
        if (operateElement) {
            // 将元素json数据加密存入剪切板
            await copyText(encrypt(JSON.stringify(operateElement)));
        }
    }

    // 剪切
    public async excuteCut() {
        await this.excuteCopy();
        await this.excuteDelete();
    }

    // 粘贴
    public async excutePaste() {
        const content = await readClipboard();
        // 粘贴的内容为元素数据
        if (typeof content === "object") {
            const element = content as IPPTElement;
            element.id = createRandomCode();
            // 新元素较旧元素偏移一段距离
            element.left += 10;
            element.top += 10;
            this._stageConfig.addElement(element);
            this._stageConfig.setOperateElement(element);
            this._stageConfig.updateElement(element);
            this._history.add();

            this._stageConfig.resetCheckDrawView();
            this._stageConfig.resetCheckDrawOprate();

            // 再次写入剪切板，为了下一次粘贴能够在上一次的基础上进行偏移
            await copyText(encrypt(JSON.stringify(element)));
        }
    }

    // 删除元素
    public excuteDelete() {
        const operateElement = this._stageConfig.operateElement;
        if (operateElement) {
            const slide = this._stageConfig.getCurrentSlide();
            const index = slide?.elements.findIndex(element => element.id === operateElement.id);
            if (typeof index !== "undefined" && index > -1) {
                slide?.elements.splice(index, 1);
                this._history.add();
                this._stageConfig.setOperateElement(null);
                this._stageConfig.resetCheckDrawOprate();
                this._stageConfig.resetCheckDrawView();
            }
        }
    }
}
