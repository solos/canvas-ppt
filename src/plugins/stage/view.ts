import Stage from ".";
import StageConfig from "./config";

export default class ViewStage extends Stage {
    constructor(container: HTMLDivElement, stageConfig: StageConfig) {
        super(container, stageConfig);

        this._drawPage();
    }

    private _drawPage() {
        const { x, y, stageWidth, stageHeight } = this.stageConfig.getStageArea();
        // 设置阴影
        this.ctx.shadowColor = "#eee";
        this.ctx.shadowBlur = 12;

        this.ctx.fillStyle = "white";
        this.ctx.fillRect(x, y, stageWidth, stageHeight);

        // 移除阴影设置
        this.ctx.shadowColor = "";
        this.ctx.shadowBlur = 0;

        const currentSlide = this.stageConfig.getCurrentSlide();
        const elements = currentSlide?.elements || [];
        this.drawElements(elements);
    }

    public resetDrawPage() {
        const width = this.stageConfig.getWidth();
        const height = this.stageConfig.getHeight();
        this.ctx.clearRect(0, 0, width, height);

        this._drawPage();
    }
}
